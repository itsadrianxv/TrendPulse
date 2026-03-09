CREATE TABLE IF NOT EXISTS strategy_profile (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  params_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_profile_enabled
  ON strategy_profile(enabled);

CREATE TABLE IF NOT EXISTS fund_binding (
  target_fund_code VARCHAR(32) PRIMARY KEY,
  target_fund_name TEXT NOT NULL,
  benchmark_fund_code VARCHAR(32) NOT NULL,
  benchmark_fund_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  strategy_profile_id BIGINT REFERENCES strategy_profile(id) ON DELETE SET NULL,
  params_override_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fund_binding_enabled
  ON fund_binding(enabled);

CREATE INDEX IF NOT EXISTS idx_fund_binding_benchmark
  ON fund_binding(benchmark_fund_code);

CREATE TABLE IF NOT EXISTS etf_sample_1m (
  id BIGSERIAL PRIMARY KEY,
  benchmark_fund_code VARCHAR(32) NOT NULL,
  sample_time TIMESTAMPTZ NOT NULL,
  price NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(benchmark_fund_code, sample_time)
);

CREATE INDEX IF NOT EXISTS idx_etf_sample_code_time
  ON etf_sample_1m(benchmark_fund_code, sample_time DESC);

CREATE TABLE IF NOT EXISTS etf_bar (
  id BIGSERIAL PRIMARY KEY,
  benchmark_fund_code VARCHAR(32) NOT NULL,
  bar_timeframe VARCHAR(8) NOT NULL,
  bar_end_time TIMESTAMPTZ NOT NULL,
  open NUMERIC(18, 6) NOT NULL,
  high NUMERIC(18, 6) NOT NULL,
  low NUMERIC(18, 6) NOT NULL,
  close NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(benchmark_fund_code, bar_timeframe, bar_end_time)
);

CREATE INDEX IF NOT EXISTS idx_etf_bar_code_tf_time
  ON etf_bar(benchmark_fund_code, bar_timeframe, bar_end_time DESC);

CREATE TABLE IF NOT EXISTS signal_event (
  id BIGSERIAL PRIMARY KEY,
  event_date DATE NOT NULL,
  event_stage VARCHAR(16) NOT NULL,
  direction VARCHAR(16) NOT NULL,
  target_fund_code VARCHAR(32) NOT NULL,
  benchmark_fund_code VARCHAR(32) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_date, event_stage, direction, target_fund_code)
);

CREATE INDEX IF NOT EXISTS idx_signal_event_lookup
  ON signal_event(event_date, target_fund_code, event_stage, direction);

CREATE TABLE IF NOT EXISTS notify_log (
  id BIGSERIAL PRIMARY KEY,
  channel VARCHAR(32) NOT NULL,
  event_id BIGINT REFERENCES signal_event(id) ON DELETE SET NULL,
  target_fund_code VARCHAR(32) NOT NULL,
  request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notify_log_event_id
  ON notify_log(event_id);
