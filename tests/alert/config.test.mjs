import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeAlertParams } from '../../app/lib/alert/config.mjs';
import { ALERT_DEFAULT_PARAMS } from '../../app/lib/alert/defaults.mjs';

test('mergeAlertParams returns trend defaults and ignores legacy fields', () => {
  const params = mergeAlertParams({
    strategyParams: {
      ema_fast: 18,
      adx_threshold: 25,
      macd_fast: 12,
      pre_alert_time: '14:58'
    },
    overrideParams: {
      pullback_lookback_bars: 5,
      td_mode: 'TD8'
    }
  });

  assert.equal(params.strategy_kind, 'trend_pullback_v1');
  assert.equal(params.timeframe, '60m');
  assert.equal(params.ema_fast, 18);
  assert.equal(params.ema_slow, ALERT_DEFAULT_PARAMS.ema_slow);
  assert.equal(params.adx_threshold, 25);
  assert.equal(params.pullback_lookback_bars, 5);
  assert.equal(params.macd_fast, undefined);
  assert.equal(params.pre_alert_time, undefined);
  assert.equal(params.td_mode, undefined);
});

test('mergeAlertParams normalizes invalid values back to safe defaults', () => {
  const params = mergeAlertParams({
    strategyParams: {
      timeframe: '15m',
      ema_fast: 'oops',
      ema_slow: -1,
      ema_slow_rising_bars: 0,
      adx_period: 0,
      adx_threshold: -10,
      pullback_lookback_bars: 0,
      pullback_touch_tolerance: -1,
      entry_cooldown_bars: -2,
      exit_below_slow_bars: 0,
      exit_channel_lookback_bars: 1
    }
  });

  assert.deepEqual(params, ALERT_DEFAULT_PARAMS);
});
