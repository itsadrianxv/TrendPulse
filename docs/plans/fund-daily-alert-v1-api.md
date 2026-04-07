# Fund Daily Alert V1 API（60m 趋势配置层）

## Strategy Profile

- `GET /api/alert/strategy-profiles?enabled=true|false`
- `POST /api/alert/strategy-profiles`
- `PUT /api/alert/strategy-profiles/{id}`
- `DELETE /api/alert/strategy-profiles/{id}`

### POST 示例

```json
{
  "name": "trend-default",
  "enabled": true,
  "params_json": {
    "strategy_kind": "trend_pullback_v1",
    "timeframe": "60m",
    "ema_fast": 20,
    "ema_slow": 60,
    "ema_slow_rising_bars": 3,
    "adx_period": 14,
    "adx_threshold": 20,
    "pullback_lookback_bars": 4,
    "pullback_touch_tolerance": 0.003,
    "entry_cooldown_bars": 2,
    "exit_below_slow_bars": 2,
    "exit_channel_lookback_bars": 10
  }
}
```

## Fund Binding

- `GET /api/alert/fund-bindings?enabled=true|false`
- `POST /api/alert/fund-bindings`
- `PUT /api/alert/fund-bindings/{target_fund_code}`
- `DELETE /api/alert/fund-bindings/{target_fund_code}`

### POST 示例

```json
{
  "target_fund_code": "161725",
  "target_fund_name": "招商中证白酒",
  "benchmark_fund_code": "512690",
  "benchmark_fund_name": "酒ETF",
  "enabled": true,
  "strategy_profile_id": 1,
  "params_override_json": {
    "adx_threshold": 24,
    "pullback_touch_tolerance": 0.0025,
    "exit_channel_lookback_bars": 12
  }
}
```

## Worker 启动

```bash
npm run worker
```

读取环境变量：

- `FEISHU_WEBHOOK_URL`
- `ALERT_TIMEZONE`
- `ENABLE_ALERT_WORKER`
- `DATABASE_URL`
