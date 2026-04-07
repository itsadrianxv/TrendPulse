import test from 'node:test';
import assert from 'node:assert/strict';

import { ALERT_DEFAULT_PARAMS, ALERT_EVENT_TYPES } from '../../app/lib/alert/defaults.mjs';
import * as engine from '../../app/lib/alert/engine.mjs';

const BASE_TIME = Date.UTC(2026, 3, 1, 2, 30, 0);

const buildBar = (index, values) => ({
  bar_end_time: new Date(BASE_TIME + index * 60 * 60 * 1000).toISOString(),
  open: values.open,
  high: values.high,
  low: values.low,
  close: values.close
});

const buildTrendBars = (count = 70, start = 100, step = 0.4) => {
  const bars = [];
  let previousClose = start;

  for (let index = 0; index < count; index += 1) {
    const close = Number((start + (index * step)).toFixed(3));
    const open = Number((previousClose + 0.08).toFixed(3));
    const high = Number((close + 0.24).toFixed(3));
    const low = Number((Math.min(open, close) - 0.24).toFixed(3));
    bars.push(buildBar(index, { open, high, low, close }));
    previousClose = close;
  }

  return bars;
};

const withTail = (bars, tail) => {
  const head = bars.slice();
  const startIndex = head.length;
  for (let index = 0; index < tail.length; index += 1) {
    head.push(buildBar(startIndex + index, tail[index]));
  }
  return head;
};

test('evaluateTrendSignal reports bars_not_enough before minimum history exists', () => {
  assert.equal(typeof engine.evaluateTrendSignal, 'function');

  const result = engine.evaluateTrendSignal({
    bars: buildTrendBars(8),
    params: ALERT_DEFAULT_PARAMS,
    context: { positionState: 'FLAT' }
  });

  assert.equal(result.hasEnoughBars, false);
  assert.equal(result.eventType, null);
  assert.equal(result.reason, 'bars_not_enough');
});

test('evaluateTrendSignal does not enter without a confirmed pullback setup', () => {
  const result = engine.evaluateTrendSignal({
    bars: buildTrendBars(90),
    params: ALERT_DEFAULT_PARAMS,
    context: { positionState: 'FLAT' }
  });

  assert.equal(result.hasEnoughBars, true);
  assert.equal(result.eventType, null);
  assert.equal(result.reason, 'entry_not_ready');
});

test('evaluateTrendSignal emits INITIAL entry after pullback reclaim in a strong trend', () => {
  const bars = withTail(buildTrendBars(80), [
    { open: 131.88, high: 132.04, low: 128.4, close: 130.35 },
    { open: 130.62, high: 132.85, low: 130.44, close: 132.46 }
  ]);

  const result = engine.evaluateTrendSignal({
    bars,
    params: ALERT_DEFAULT_PARAMS,
    context: { positionState: 'FLAT' }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.ENTRY);
  assert.equal(result.entryMode, 'INITIAL');
  assert.match(result.reason, /pullback/i);
  assert.ok(result.triggerAnchorTime);
});

test('evaluateTrendSignal emits ADD entry only when a new anchor appears after cooldown', () => {
  const bars = withTail(buildTrendBars(80), [
    { open: 131.88, high: 132.04, low: 128.4, close: 130.35 },
    { open: 130.62, high: 132.85, low: 130.44, close: 132.46 },
    { open: 132.58, high: 133.22, low: 132.42, close: 133.02 },
    { open: 133.12, high: 133.44, low: 129.4, close: 131.18 },
    { open: 131.44, high: 134.08, low: 131.28, close: 133.84 }
  ]);

  const lastEntryBarEndTime = bars[bars.length - 4].bar_end_time;
  const lastEntryAnchorTime = bars[bars.length - 5].bar_end_time;

  const result = engine.evaluateTrendSignal({
    bars,
    params: ALERT_DEFAULT_PARAMS,
    context: {
      positionState: 'LONG',
      lastEntryBarEndTime,
      lastEntryAnchorTime
    }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.ENTRY);
  assert.equal(result.entryMode, 'ADD');
  assert.notEqual(result.triggerAnchorTime, lastEntryAnchorTime);
});

test('evaluateTrendSignal emits EXIT after two closes below ema slow', () => {
  const bars = withTail(buildTrendBars(82), [
    { open: 132.36, high: 132.44, low: 119.2, close: 120.14 },
    { open: 120.2, high: 120.42, low: 118.72, close: 119.16 }
  ]);

  const result = engine.evaluateTrendSignal({
    bars,
    params: ALERT_DEFAULT_PARAMS,
    context: { positionState: 'LONG' }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.EXIT);
  assert.equal(result.reason, 'exit_below_ema_slow');
});

test('evaluateTrendSignal emits EXIT on channel breakdown even without two-bar ema break', () => {
  const bars = withTail(buildTrendBars(82), [
    { open: 132.44, high: 132.76, low: 131.96, close: 132.58 },
    { open: 132.3, high: 132.46, low: 121.12, close: 123.54 }
  ]);

  const result = engine.evaluateTrendSignal({
    bars,
    params: {
      ...ALERT_DEFAULT_PARAMS,
      exit_below_slow_bars: 3
    },
    context: { positionState: 'LONG' }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.EXIT);
  assert.equal(result.reason, 'exit_channel_break');
});

test('evaluateTrendSignal emits SETUP_INVALIDATED when pullback loses ema60 before confirmation', () => {
  const bars = withTail(buildTrendBars(80), [
    { open: 131.88, high: 132.04, low: 128.4, close: 130.35 },
    { open: 130.24, high: 130.38, low: 119.2, close: 120 }
  ]);

  const result = engine.evaluateTrendSignal({
    bars,
    params: ALERT_DEFAULT_PARAMS,
    context: { positionState: 'FLAT' }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.SETUP_INVALIDATED);
  assert.equal(result.reason, 'setup_lost_ema60');
});

test('resolveTrendEventPriority prefers EXIT over ENTRY when both candidates exist', () => {
  assert.equal(typeof engine.resolveTrendEventPriority, 'function');

  const result = engine.resolveTrendEventPriority({
    exitCandidate: { eventType: ALERT_EVENT_TYPES.EXIT, reason: 'exit_channel_break' },
    entryCandidate: { eventType: ALERT_EVENT_TYPES.ENTRY, reason: 'pullback_reclaimed' },
    invalidatedCandidate: { eventType: ALERT_EVENT_TYPES.SETUP_INVALIDATED, reason: 'setup_lost_ema60' }
  });

  assert.equal(result.eventType, ALERT_EVENT_TYPES.EXIT);
  assert.equal(result.reason, 'exit_channel_break');
});

