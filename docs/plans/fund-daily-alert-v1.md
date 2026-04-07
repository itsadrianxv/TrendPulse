# 基金日频量化提醒系统 V1（60m 趋势版）

> 更新时间：2026-04-07  
> 面向读者：Coding Agent / 项目维护者

## 1. 项目定位

- 系统只负责基金/ETF 的择时提醒，不下单、不对接交易 API。
- 每只目标基金绑定一个 benchmark ETF，所有趋势信号都基于 benchmark ETF 的 60 分钟伪 K 线。
- 策略定位为 **long-only 趋势跟踪**，目标是抓住 5 天以上的波段趋势，而不是日内抄底逃顶。

## 2. 配置模型

### 2.1 配置优先级

`fund_binding.params_override_json > strategy_profile.params_json > 代码默认值`

### 2.2 策略参数模板

表：`strategy_profile`

```json
{
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
```

### 2.3 基金绑定

表：`fund_binding`

- `target_fund_code`
- `target_fund_name`
- `benchmark_fund_code`
- `benchmark_fund_name`
- `strategy_profile_id`
- `params_override_json`
- `enabled`

## 3. 策略规则

### 3.1 趋势成立

最新 60m bar 必须同时满足：

- `close > EMA20 > EMA60`
- `EMA60[t] > EMA60[t-3]`
- `ADX(14) >= 20`
- `+DI > -DI`

### 3.2 Pullback Anchor

在当前 bar 之前最近 4 根已完成 60m bar 中，取最近一根满足以下条件的 bar 作为唯一 pullback anchor：

- `low <= EMA20 * (1 + pullback_touch_tolerance)`
- `close >= EMA60`

### 3.3 入场与加仓

当前 bar 满足以下再起确认后，可触发 `ENTRY`：

- 已存在有效 pullback anchor
- `close > previous high`
- `close > EMA20`
- `close > open`

事件解释：

- 上一状态为 `FLAT`：`ENTRY(INITIAL)`
- 上一状态为 `LONG` 且出现新的 anchor，且距离上一次 `ENTRY` 至少 2 根 bar：`ENTRY(ADD)`
- 同一个 anchor 不能重复触发 `ENTRY`

### 3.4 退出

已持仓状态下，满足以下任一条件即触发 `EXIT`：

- 连续 2 根收盘价低于 `EMA60`
- 当前收盘价跌破前 10 根 bar 的最低 low

### 3.5 Setup 失效

如果已经识别出 pullback anchor，但当前 bar 在确认前出现以下任一情况，则记录 `SETUP_INVALIDATED`：

- `close < EMA60`
- `+DI <= -DI`

该事件仅用于审计，不发送飞书。

## 4. 日内时序

### 4.1 每分钟任务

- `09:31 ~ 11:30`、`13:01 ~ 14:59`：采样 benchmark ETF 最新价
- 到达 60m 收线时：聚合伪 K，并立即评估趋势事件

### 4.2 60m 收线点

- `10:30`
- `11:30`
- `14:00`
- `15:00`

## 5. 事件与通知

### 5.1 信号事件

`signal_event` 只保留三类状态事件：

- `ENTRY`
- `EXIT`
- `SETUP_INVALIDATED`

### 5.2 飞书通知

只对以下事件推送飞书：

- `ENTRY(INITIAL)`：趋势入场
- `ENTRY(ADD)`：趋势加仓
- `EXIT`：趋势退出

消息正文必须包含：

- `bar_end_time`
- `close`
- `EMA20`
- `EMA60`
- `ADX`
- `trigger_anchor_time`
- `reason`

## 6. Done Definition

1. 可在 `/alert-config` 中创建和编辑趋势策略模板
2. 可为单只基金覆盖趋势参数，不改代码即可生效
3. worker 仅在 60m 收线时评估趋势事件
4. `ENTRY / EXIT` 事件会推送飞书并写审计日志
5. `SETUP_INVALIDATED` 只落库，不推送飞书
6. 数据库表结构、文档和示例 JSON 都与 60m 趋势策略保持一致
