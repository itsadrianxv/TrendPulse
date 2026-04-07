import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  ALERT_BAR_CLOSES,
  ALERT_DEFAULT_PARAMS,
  ALERT_EVENT_TYPES,
  ALERT_POSITION_STATES,
  ALERT_TIMEFRAME
} from './defaults.mjs';

dayjs.extend(utc);
dayjs.extend(timezone);

const MORNING_START = '09:31';
const MORNING_END = '11:30';
const AFTERNOON_START = '13:01';
const AFTERNOON_END = '15:00';

export const toDayjsInTimezone = (input, tz) => dayjs(input).tz(tz);

export const formatHHmm = (input, tz) => toDayjsInTimezone(input, tz).format('HH:mm');

const toMinutes = (hhmm) => {
  const [hour, minute] = String(hhmm).split(':').map(Number);
  return hour * 60 + minute;
};

const isInRange = (minuteOfDay, start, end) => {
  const startMinute = toMinutes(start);
  const endMinute = toMinutes(end);
  return minuteOfDay >= startMinute && minuteOfDay <= endMinute;
};

export const isTradingMinute = (input, tz) => {
  const hhmm = formatHHmm(input, tz);
  const minuteOfDay = toMinutes(hhmm);
  return (
    isInRange(minuteOfDay, MORNING_START, MORNING_END)
    || isInRange(minuteOfDay, AFTERNOON_START, AFTERNOON_END)
  );
};

export const isBarCloseMinute = (timeframe, hhmm) => {
  const closes = ALERT_BAR_CLOSES[timeframe] || [];
  return closes.includes(hhmm);
};

const addMinutesToHHmm = (hhmm, minutes) => {
  const [hour, minute] = hhmm.split(':').map(Number);
  const total = hour * 60 + minute + minutes;
  const safe = Math.max(total, 0);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

export const resolveBarWindow = (baseDate, timeframe, closeHHmm, tz) => {
  const closes = ALERT_BAR_CLOSES[timeframe] || [];
  const idx = closes.indexOf(closeHHmm);
  if (idx < 0) {
    return null;
  }

  const startHHmm = idx === 0 ? MORNING_START : addMinutesToHHmm(closes[idx - 1], 1);
  const dateStr = toDayjsInTimezone(baseDate, tz).format('YYYY-MM-DD');
  const start = dayjs.tz(`${dateStr} ${startHHmm}`, 'YYYY-MM-DD HH:mm', tz);
  const end = dayjs.tz(`${dateStr} ${closeHHmm}`, 'YYYY-MM-DD HH:mm', tz);

  return { start, end };
};

export const aggregatePseudoBar = (samples) => {
  if (!Array.isArray(samples) || !samples.length) {
    return null;
  }

  const prices = samples
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!prices.length) {
    return null;
  }

  return {
    open: prices[0],
    high: Math.max(...prices),
    low: Math.min(...prices),
    close: prices[prices.length - 1]
  };
};

const ema = (values, period) => {
  if (!values.length) {
    return [];
  }

  const alpha = 2 / (period + 1);
  const output = [];
  let previous = values[0];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    previous = index === 0 ? value : (value * alpha) + (previous * (1 - alpha));
    output.push(previous);
  }

  return output;
};

const buildDmiSeries = (bars, period) => {
  const length = bars.length;
  const plusDi = new Array(length).fill(null);
  const minusDi = new Array(length).fill(null);
  const adx = new Array(length).fill(null);

  if (length <= period * 2) {
    return { plusDi, minusDi, adx };
  }

  const tr = new Array(length).fill(0);
  const plusDm = new Array(length).fill(0);
  const minusDm = new Array(length).fill(0);

  for (let index = 1; index < length; index += 1) {
    const current = bars[index];
    const previous = bars[index - 1];

    const highDiff = Number(current.high) - Number(previous.high);
    const lowDiff = Number(previous.low) - Number(current.low);

    plusDm[index] = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    minusDm[index] = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const currentHigh = Number(current.high);
    const currentLow = Number(current.low);
    const previousClose = Number(previous.close);

    tr[index] = Math.max(
      currentHigh - currentLow,
      Math.abs(currentHigh - previousClose),
      Math.abs(currentLow - previousClose)
    );
  }

  let smoothedTr = 0;
  let smoothedPlusDm = 0;
  let smoothedMinusDm = 0;

  for (let index = 1; index <= period; index += 1) {
    smoothedTr += tr[index];
    smoothedPlusDm += plusDm[index];
    smoothedMinusDm += minusDm[index];
  }

  const dx = new Array(length).fill(null);

  for (let index = period; index < length; index += 1) {
    if (index > period) {
      smoothedTr = smoothedTr - (smoothedTr / period) + tr[index];
      smoothedPlusDm = smoothedPlusDm - (smoothedPlusDm / period) + plusDm[index];
      smoothedMinusDm = smoothedMinusDm - (smoothedMinusDm / period) + minusDm[index];
    }

    if (smoothedTr <= 0) {
      continue;
    }

    plusDi[index] = (smoothedPlusDm / smoothedTr) * 100;
    minusDi[index] = (smoothedMinusDm / smoothedTr) * 100;

    const denominator = plusDi[index] + minusDi[index];
    dx[index] = denominator > 0
      ? (Math.abs(plusDi[index] - minusDi[index]) / denominator) * 100
      : 0;
  }

  const adxStart = period * 2 - 1;
  let dxSum = 0;

  for (let index = period; index <= adxStart; index += 1) {
    dxSum += dx[index] ?? 0;
  }

  adx[adxStart] = dxSum / period;

  for (let index = adxStart + 1; index < length; index += 1) {
    adx[index] = (((adx[index - 1] ?? 0) * (period - 1)) + (dx[index] ?? 0)) / period;
  }

  return { plusDi, minusDi, adx };
};

const resolveMinimumBars = (params) => Math.max(
  params.ema_slow + params.ema_slow_rising_bars + 2,
  params.adx_period * 2 + 2,
  params.pullback_lookback_bars + 2,
  params.exit_channel_lookback_bars + 1,
  params.exit_below_slow_bars + 1
);

const getBarIndexByEndTime = (bars, barEndTime) => bars.findIndex((bar) => bar.bar_end_time === barEndTime);

const findPullbackAnchorIndex = ({ bars, emaFastSeries, emaSlowSeries, latestIndex, params }) => {
  const firstIndex = Math.max(0, latestIndex - params.pullback_lookback_bars);

  for (let index = latestIndex - 1; index >= firstIndex; index -= 1) {
    const emaFastValue = emaFastSeries[index];
    const emaSlowValue = emaSlowSeries[index];
    if (!Number.isFinite(emaFastValue) || !Number.isFinite(emaSlowValue)) {
      continue;
    }

    const low = Number(bars[index].low);
    const close = Number(bars[index].close);
    const touchedFast = low <= emaFastValue * (1 + params.pullback_touch_tolerance);
    const heldSlow = close >= emaSlowValue;

    if (touchedFast && heldSlow) {
      return index;
    }
  }

  return null;
};

const buildExitCandidate = ({ bars, emaSlowSeries, latestIndex, params, positionState }) => {
  if (positionState !== ALERT_POSITION_STATES.LONG) {
    return null;
  }

  let consecutiveBelowSlow = true;
  for (let offset = 0; offset < params.exit_below_slow_bars; offset += 1) {
    const index = latestIndex - offset;
    if (index < 0 || Number(bars[index].close) >= emaSlowSeries[index]) {
      consecutiveBelowSlow = false;
      break;
    }
  }

  if (consecutiveBelowSlow) {
    return {
      eventType: ALERT_EVENT_TYPES.EXIT,
      reason: 'exit_below_ema_slow'
    };
  }

  const channelStart = Math.max(0, latestIndex - params.exit_channel_lookback_bars);
  const channelLow = Math.min(
    ...bars.slice(channelStart, latestIndex).map((bar) => Number(bar.low))
  );

  if (Number.isFinite(channelLow) && Number(bars[latestIndex].close) < channelLow) {
    return {
      eventType: ALERT_EVENT_TYPES.EXIT,
      reason: 'exit_channel_break'
    };
  }

  return null;
};

const buildEntryCandidate = ({
  bars,
  emaFastSeries,
  emaSlowSeries,
  adxSeries,
  plusDiSeries,
  minusDiSeries,
  latestIndex,
  params,
  context,
  anchorIndex
}) => {
  if (anchorIndex === null) {
    return null;
  }

  const latestBar = bars[latestIndex];
  const previousBar = bars[latestIndex - 1];

  const emaFastValue = emaFastSeries[latestIndex];
  const emaSlowValue = emaSlowSeries[latestIndex];
  const adxValue = adxSeries[latestIndex];
  const plusDiValue = plusDiSeries[latestIndex];
  const minusDiValue = minusDiSeries[latestIndex];
  const slowRisingIndex = latestIndex - params.ema_slow_rising_bars;

  const trendActive = (
    Number(latestBar.close) > emaFastValue
    && emaFastValue > emaSlowValue
    && emaSlowValue > emaSlowSeries[slowRisingIndex]
    && adxValue >= params.adx_threshold
    && plusDiValue > minusDiValue
  );

  const confirmation = (
    latestIndex > anchorIndex
    && Number(latestBar.close) > Number(previousBar.high)
    && Number(latestBar.close) > emaFastValue
    && Number(latestBar.close) > Number(latestBar.open)
  );

  if (!trendActive || !confirmation) {
    return null;
  }

  const anchorBar = bars[anchorIndex];
  if (context.lastEntryAnchorTime && context.lastEntryAnchorTime === anchorBar.bar_end_time) {
    return null;
  }

  if (context.positionState === ALERT_POSITION_STATES.LONG && context.lastEntryBarEndTime) {
    const lastEntryIndex = getBarIndexByEndTime(bars, context.lastEntryBarEndTime);
    if (lastEntryIndex >= 0 && (latestIndex - lastEntryIndex) < params.entry_cooldown_bars) {
      return null;
    }
  }

  return {
    eventType: ALERT_EVENT_TYPES.ENTRY,
    entryMode: context.positionState === ALERT_POSITION_STATES.LONG ? 'ADD' : 'INITIAL',
    reason: 'pullback_reclaimed_ema20',
    triggerAnchorTime: anchorBar.bar_end_time
  };
};

const buildInvalidatedCandidate = ({
  bars,
  emaSlowSeries,
  plusDiSeries,
  minusDiSeries,
  latestIndex,
  anchorIndex
}) => {
  if (anchorIndex === null || latestIndex <= anchorIndex) {
    return null;
  }

  const latestClose = Number(bars[latestIndex].close);
  if (latestClose < emaSlowSeries[latestIndex]) {
    return {
      eventType: ALERT_EVENT_TYPES.SETUP_INVALIDATED,
      reason: 'setup_lost_ema60',
      triggerAnchorTime: bars[anchorIndex].bar_end_time
    };
  }

  if ((plusDiSeries[latestIndex] ?? 0) <= (minusDiSeries[latestIndex] ?? 0)) {
    return {
      eventType: ALERT_EVENT_TYPES.SETUP_INVALIDATED,
      reason: 'setup_lost_dmi_support',
      triggerAnchorTime: bars[anchorIndex].bar_end_time
    };
  }

  return null;
};

export const resolveTrendEventPriority = ({ exitCandidate, entryCandidate, invalidatedCandidate }) => (
  exitCandidate
  || entryCandidate
  || invalidatedCandidate
  || null
);

export const evaluateTrendSignal = ({
  bars,
  params = ALERT_DEFAULT_PARAMS,
  context = { positionState: ALERT_POSITION_STATES.FLAT }
}) => {
  const safeBars = Array.isArray(bars) ? bars : [];
  const requiredBars = resolveMinimumBars(params);

  if (safeBars.length < requiredBars) {
    return {
      hasEnoughBars: false,
      eventType: null,
      reason: 'bars_not_enough',
      barEndTime: safeBars[safeBars.length - 1]?.bar_end_time || null
    };
  }

  const closes = safeBars.map((bar) => Number(bar.close));
  const emaFastSeries = ema(closes, params.ema_fast);
  const emaSlowSeries = ema(closes, params.ema_slow);
  const { plusDi, minusDi, adx } = buildDmiSeries(safeBars, params.adx_period);
  const latestIndex = safeBars.length - 1;
  const anchorIndex = findPullbackAnchorIndex({
    bars: safeBars,
    emaFastSeries,
    emaSlowSeries,
    latestIndex,
    params
  });

  const exitCandidate = buildExitCandidate({
    bars: safeBars,
    emaSlowSeries,
    latestIndex,
    params,
    positionState: context.positionState
  });

  const entryCandidate = buildEntryCandidate({
    bars: safeBars,
    emaFastSeries,
    emaSlowSeries,
    adxSeries: adx,
    plusDiSeries: plusDi,
    minusDiSeries: minusDi,
    latestIndex,
    params,
    context,
    anchorIndex
  });

  const invalidatedCandidate = buildInvalidatedCandidate({
    bars: safeBars,
    emaSlowSeries,
    plusDiSeries: plusDi,
    minusDiSeries: minusDi,
    latestIndex,
    anchorIndex
  });

  const resolved = resolveTrendEventPriority({
    exitCandidate,
    entryCandidate,
    invalidatedCandidate
  });

  const latestBar = safeBars[latestIndex];

  return {
    hasEnoughBars: true,
    eventType: resolved?.eventType || null,
    entryMode: resolved?.entryMode || null,
    reason: resolved?.reason || 'entry_not_ready',
    barTimeframe: ALERT_TIMEFRAME,
    barEndTime: latestBar.bar_end_time,
    triggerAnchorTime: resolved?.triggerAnchorTime || (anchorIndex === null ? null : safeBars[anchorIndex].bar_end_time),
    indicators: {
      close: Number(latestBar.close),
      emaFast: emaFastSeries[latestIndex],
      emaSlow: emaSlowSeries[latestIndex],
      adx: adx[latestIndex],
      plusDi: plusDi[latestIndex],
      minusDi: minusDi[latestIndex]
    }
  };
};
