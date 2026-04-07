import { ALERT_DEFAULT_PARAMS, ALERT_TIMEFRAME } from './defaults.mjs';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base, incoming) => {
  const output = { ...base };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
};

const normalizeInteger = (value, fallback, minimum = 1) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
};

const normalizeFloat = (value, fallback, minimum = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > minimum ? parsed : fallback;
};

const normalizeParams = (params) => {
  const normalized = {
    strategy_kind: ALERT_DEFAULT_PARAMS.strategy_kind,
    timeframe: ALERT_TIMEFRAME,
    ema_fast: normalizeInteger(params?.ema_fast, ALERT_DEFAULT_PARAMS.ema_fast),
    ema_slow: normalizeInteger(params?.ema_slow, ALERT_DEFAULT_PARAMS.ema_slow),
    ema_slow_rising_bars: normalizeInteger(
      params?.ema_slow_rising_bars,
      ALERT_DEFAULT_PARAMS.ema_slow_rising_bars
    ),
    adx_period: normalizeInteger(params?.adx_period, ALERT_DEFAULT_PARAMS.adx_period),
    adx_threshold: normalizeFloat(params?.adx_threshold, ALERT_DEFAULT_PARAMS.adx_threshold),
    pullback_lookback_bars: normalizeInteger(
      params?.pullback_lookback_bars,
      ALERT_DEFAULT_PARAMS.pullback_lookback_bars
    ),
    pullback_touch_tolerance: normalizeFloat(
      params?.pullback_touch_tolerance,
      ALERT_DEFAULT_PARAMS.pullback_touch_tolerance
    ),
    entry_cooldown_bars: normalizeInteger(
      params?.entry_cooldown_bars,
      ALERT_DEFAULT_PARAMS.entry_cooldown_bars
    ),
    exit_below_slow_bars: normalizeInteger(
      params?.exit_below_slow_bars,
      ALERT_DEFAULT_PARAMS.exit_below_slow_bars
    ),
    exit_channel_lookback_bars: normalizeInteger(
      params?.exit_channel_lookback_bars,
      ALERT_DEFAULT_PARAMS.exit_channel_lookback_bars,
      2
    )
  };

  if (normalized.ema_slow <= normalized.ema_fast) {
    normalized.ema_slow = ALERT_DEFAULT_PARAMS.ema_slow;
  }

  return normalized;
};

export const mergeAlertParams = ({ strategyParams, overrideParams } = {}) => {
  const merged = deepMerge(
    deepMerge(ALERT_DEFAULT_PARAMS, isPlainObject(strategyParams) ? strategyParams : {}),
    isPlainObject(overrideParams) ? overrideParams : {}
  );

  return normalizeParams(merged);
};

export const resolveBindingRuntimeConfig = (bindingRow) => {
  const params = mergeAlertParams({
    strategyParams: bindingRow?.strategy_enabled === false ? {} : bindingRow?.strategy_params_json,
    overrideParams: bindingRow?.params_override_json
  });

  return {
    targetFundCode: bindingRow?.target_fund_code,
    targetFundName: bindingRow?.target_fund_name,
    benchmarkFundCode: bindingRow?.benchmark_fund_code,
    benchmarkFundName: bindingRow?.benchmark_fund_name,
    strategyProfileId: bindingRow?.strategy_profile_id,
    strategyProfileName: bindingRow?.strategy_profile_name || null,
    params
  };
};
