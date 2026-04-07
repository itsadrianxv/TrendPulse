import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  ensureAlertSchema,
  insertNotifyLog,
  listActiveFundValuationTargets,
  listEnabledBindingsWithProfile,
  listEtfSamplesInRange,
  listRecentBars,
  listRecentSignalEvents,
  upsertEtfBar,
  upsertEtfSample1m,
  upsertFundValuationSample1m,
  upsertSignalEvent
} from './db.mjs';
import { resolveBindingRuntimeConfig } from './config.mjs';
import { evaluateTrendSignal, formatHHmm, isBarCloseMinute, isTradingMinute, resolveBarWindow, aggregatePseudoBar } from './engine.mjs';
import { fetchBenchmarkLatestPrice } from './market.mjs';
import { fetchFundRealtimeValuation } from '../valuation/fetch.mjs';
import {
  ALERT_EVENT_TYPES,
  ALERT_POSITION_STATES,
  ALERT_SIGNAL_SIDES,
  ALERT_TIMEFRAME,
  ALERT_TIMEFRAMES
} from './defaults.mjs';
import { buildFeishuMessageText, sendFeishuTextMessage } from './notifier.mjs';

dayjs.extend(utc);
dayjs.extend(timezone);

const log = (...args) => {
  console.log('[fund-alert-worker]', ...args);
};

const nowInTz = (tz) => dayjs().tz(tz).second(0).millisecond(0);

const isSamplingMinute = (input, tz) => {
  const hhmm = formatHHmm(input, tz);
  const morning = hhmm >= '09:31' && hhmm <= '11:30';
  const afternoon = hhmm >= '13:01' && hhmm <= '14:59';
  return morning || afternoon;
};

export const shouldEvaluateSignalMinute = (hhmm) => isBarCloseMinute(ALERT_TIMEFRAME, hhmm);

const loadRuntimeBindings = async () => {
  const rows = await listEnabledBindingsWithProfile();
  return rows.map((row) => resolveBindingRuntimeConfig(row));
};

const sampleBenchmarks = async ({ runtimeBindings, timestamp }) => {
  const benchmarkCodes = [...new Set(runtimeBindings.map((item) => item.benchmarkFundCode).filter(Boolean))];

  for (const benchmarkCode of benchmarkCodes) {
    try {
      const quote = await fetchBenchmarkLatestPrice(benchmarkCode);
      await upsertEtfSample1m({
        benchmarkFundCode: benchmarkCode,
        sampleTime: timestamp.toDate(),
        price: quote.price
      });
    } catch (error) {
      log('sample_failed', benchmarkCode, error.message);
    }
  }
};

const sampleFundValuations = async ({ targets, timestamp }) => {
  const tradeDate = timestamp.format('YYYY-MM-DD');

  for (const target of targets) {
    try {
      const valuation = await fetchFundRealtimeValuation(target.fund_code);
      await upsertFundValuationSample1m({
        fundCode: target.fund_code,
        tradeDate,
        sampleMinute: timestamp.toDate(),
        estimateNav: valuation.estimateNav,
        estimateChangePercent: valuation.estimateChangePercent,
        latestNav: valuation.latestNav,
        navDate: valuation.navDate,
        estimateTime: valuation.estimateTime
      });
    } catch (error) {
      log('valuation_sample_failed', target.fund_code, error.message);
    }
  }
};

const aggregateClosedBars = async ({ runtimeBindings, timestamp, timezoneName }) => {
  const hhmm = timestamp.format('HH:mm');
  const uniqueBenchmarkCodes = [...new Set(runtimeBindings.map((item) => item.benchmarkFundCode).filter(Boolean))];

  for (const timeframe of ALERT_TIMEFRAMES) {
    if (!isBarCloseMinute(timeframe, hhmm)) {
      continue;
    }

    const barWindow = resolveBarWindow(timestamp, timeframe, hhmm, timezoneName);
    if (!barWindow) {
      continue;
    }

    for (const benchmarkCode of uniqueBenchmarkCodes) {
      const samples = await listEtfSamplesInRange({
        benchmarkFundCode: benchmarkCode,
        startTime: barWindow.start.toDate(),
        endTime: barWindow.end.toDate()
      });

      const bar = aggregatePseudoBar(samples);
      if (!bar) {
        continue;
      }

      await upsertEtfBar({
        benchmarkFundCode: benchmarkCode,
        timeframe,
        barEndTime: barWindow.end.toDate(),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close
      });
    }
  }
};

const resolvePositionContext = ({ bars, events }) => {
  const sortedEvents = [...(events || [])]
    .filter((event) => event.signal_side === ALERT_SIGNAL_SIDES.LONG)
    .sort((left, right) => new Date(left.bar_end_time) - new Date(right.bar_end_time));

  let positionState = ALERT_POSITION_STATES.FLAT;
  let lastEntryBarEndTime = null;
  let lastEntryAnchorTime = null;

  for (const event of sortedEvents) {
    if (event.event_type === ALERT_EVENT_TYPES.EXIT) {
      positionState = ALERT_POSITION_STATES.FLAT;
      lastEntryBarEndTime = null;
      lastEntryAnchorTime = null;
      continue;
    }

    if (event.event_type === ALERT_EVENT_TYPES.ENTRY) {
      positionState = ALERT_POSITION_STATES.LONG;
      lastEntryBarEndTime = event.bar_end_time;
      lastEntryAnchorTime = event.trigger_anchor_time || event.payload_json?.trigger_anchor_time || null;
    }
  }

  const lastEntryIndex = lastEntryBarEndTime
    ? bars.findIndex((bar) => bar.bar_end_time === lastEntryBarEndTime)
    : -1;

  return {
    positionState,
    lastEntryBarEndTime,
    lastEntryAnchorTime,
    lastEntryIndex
  };
};

export const buildSignalEventDecision = ({ binding, signal, existingEvents }) => {
  if (!signal?.eventType) {
    return null;
  }

  const duplicate = (existingEvents || []).some((event) => (
    event.event_type === signal.eventType
    && event.bar_end_time === signal.barEndTime
  ));

  if (duplicate) {
    return null;
  }

  const payload = {
    event_type: signal.eventType,
    entry_mode: signal.entryMode || null,
    reason: signal.reason,
    bar_timeframe: signal.barTimeframe,
    bar_end_time: signal.barEndTime,
    trigger_anchor_time: signal.triggerAnchorTime || null,
    indicators: signal.indicators
  };

  return {
    shouldPersist: true,
    shouldNotify: signal.eventType !== ALERT_EVENT_TYPES.SETUP_INVALIDATED,
    event: {
      event_type: signal.eventType,
      signal_side: ALERT_SIGNAL_SIDES.LONG,
      target_fund_code: binding.targetFundCode,
      benchmark_fund_code: binding.benchmarkFundCode,
      bar_timeframe: signal.barTimeframe,
      bar_end_time: signal.barEndTime,
      trigger_anchor_time: signal.triggerAnchorTime || null,
      payload_json: payload,
      sent: false
    }
  };
};

const persistEvent = async ({ decision, webhookUrl, binding }) => {
  let eventRecord = await upsertSignalEvent(decision.event);

  if (!decision.shouldNotify) {
    return { eventRecord, notified: false };
  }

  let notifyResult;
  let success = false;

  try {
    const text = buildFeishuMessageText({
      binding,
      payload: {
        ...decision.event.payload_json,
        eventType: decision.event.event_type,
        entryMode: decision.event.payload_json.entry_mode
      }
    });

    notifyResult = await sendFeishuTextMessage({ webhookUrl, text });
    success = Boolean(notifyResult.success);

    eventRecord = await upsertSignalEvent({
      ...decision.event,
      sent: success
    });

    await insertNotifyLog({
      channel: 'FEISHU',
      eventId: eventRecord?.id || null,
      targetFundCode: binding.targetFundCode,
      request: notifyResult.requestBody || {},
      response: notifyResult.responseBody || {},
      success
    });
  } catch (error) {
    notifyResult = { error: error.message };

    await insertNotifyLog({
      channel: 'FEISHU',
      eventId: eventRecord?.id || null,
      targetFundCode: binding.targetFundCode,
      request: {},
      response: notifyResult,
      success: false
    });
  }

  return {
    eventRecord,
    notified: success
  };
};

const evaluateBindingSignal = async ({ binding, cutoffTime }) => {
  const bars = await listRecentBars({
    benchmarkFundCode: binding.benchmarkFundCode,
    timeframe: ALERT_TIMEFRAME,
    barEndTimeLte: cutoffTime.toDate(),
    limit: 240
  });

  const priorEvents = await listRecentSignalEvents({
    targetFundCode: binding.targetFundCode,
    barEndTimeLte: cutoffTime.toDate(),
    limit: 100
  });

  const context = resolvePositionContext({ bars, events: priorEvents });
  const signal = evaluateTrendSignal({
    bars,
    params: binding.params,
    context
  });

  return { signal, priorEvents };
};

const processBindingBarClose = async ({ binding, timestamp, webhookUrl }) => {
  const { signal, priorEvents } = await evaluateBindingSignal({
    binding,
    cutoffTime: timestamp
  });

  const decision = buildSignalEventDecision({
    binding,
    signal,
    existingEvents: priorEvents
  });

  if (!decision) {
    return;
  }

  await persistEvent({
    decision,
    webhookUrl,
    binding
  });
};

export const runWorkerTick = async ({ timezoneName, webhookUrl }) => {
  await ensureAlertSchema();

  const now = nowInTz(timezoneName);
  const runtimeBindings = await loadRuntimeBindings();
  const valuationTargets = await listActiveFundValuationTargets();

  if (!runtimeBindings.length && !valuationTargets.length) {
    log('tick_skip_no_binding_or_subscription', now.format());
    return;
  }

  if (isSamplingMinute(now, timezoneName)) {
    await sampleBenchmarks({ runtimeBindings, timestamp: now });
    if (valuationTargets.length) {
      await sampleFundValuations({ targets: valuationTargets, timestamp: now });
    }
  }

  if (runtimeBindings.length) {
    await aggregateClosedBars({
      runtimeBindings,
      timestamp: now,
      timezoneName
    });
  }

  if (runtimeBindings.length && shouldEvaluateSignalMinute(now.format('HH:mm'))) {
    for (const binding of runtimeBindings) {
      await processBindingBarClose({
        binding,
        timestamp: now,
        webhookUrl
      });
    }
  }

  log(
    'tick_done',
    now.format(),
    `bindings=${runtimeBindings.length}`,
    `valuations=${valuationTargets.length}`
  );
};

export const startWorkerLoop = async ({ timezoneName, webhookUrl }) => {
  if (String(process.env.ENABLE_ALERT_WORKER || 'true').toLowerCase() !== 'true') {
    log('worker_disabled_by_env');
    return;
  }

  log('worker_started', `timezone=${timezoneName}`);

  await runWorkerTick({ timezoneName, webhookUrl });

  const scheduleNext = async () => {
    const now = dayjs().tz(timezoneName);
    const nextMinute = now.add(1, 'minute').second(0).millisecond(0);
    const waitMs = Math.max(100, nextMinute.diff(now, 'millisecond'));

    setTimeout(async () => {
      try {
        const tickNow = dayjs().tz(timezoneName);
        const hhmm = tickNow.format('HH:mm');

        if (isTradingMinute(tickNow, timezoneName) || shouldEvaluateSignalMinute(hhmm)) {
          await runWorkerTick({ timezoneName, webhookUrl });
        }
      } catch (error) {
        log('tick_error', error.message);
      } finally {
        await scheduleNext();
      }
    }, waitMs);
  };

  await scheduleNext();
};
