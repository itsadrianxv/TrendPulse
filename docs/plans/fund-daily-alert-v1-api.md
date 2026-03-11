# Fund Daily Alert V1 API（配置层）

## Strategy Profile

- `GET /api/alert/strategy-profiles?enabled=true|false`
- `POST /api/alert/strategy-profiles`
- `PUT /api/alert/strategy-profiles/{id}`
- `DELETE /api/alert/strategy-profiles/{id}`

### POST 示例

```json
{
  "name": "default-v1-custom",
  "enabled": true,
  "params_json": {
    "macd_fast": 12,
    "macd_slow": 26,
    "pre_alert_time": "14:50",
    "exec_alert_time": "14:58",
    "review_time": "15:00"
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
    "pre_alert_time": "14:50",
    "exec_alert_time": "14:58"
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
