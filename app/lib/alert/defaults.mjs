export const ALERT_TIMEFRAME = '60m';
export const ALERT_TIMEFRAMES = [ALERT_TIMEFRAME];

export const ALERT_DEFAULT_PARAMS = {
  strategy_kind: 'trend_pullback_v1',
  timeframe: ALERT_TIMEFRAME,
  ema_fast: 20,
  ema_slow: 60,
  ema_slow_rising_bars: 3,
  adx_period: 14,
  adx_threshold: 20,
  pullback_lookback_bars: 4,
  pullback_touch_tolerance: 0.003,
  entry_cooldown_bars: 2,
  exit_below_slow_bars: 2,
  exit_channel_lookback_bars: 10
};

export const ALERT_BAR_CLOSES = {
  [ALERT_TIMEFRAME]: ['10:30', '11:30', '14:00', '15:00']
};

export const ALERT_EVENT_TYPES = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  SETUP_INVALIDATED: 'SETUP_INVALIDATED'
};

export const ALERT_SIGNAL_SIDES = {
  LONG: 'LONG'
};

export const ALERT_POSITION_STATES = {
  FLAT: 'FLAT',
  LONG: 'LONG'
};
