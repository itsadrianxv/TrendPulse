# 架构总览

## 运行时角色

### Web

- 技术栈：Next.js App Router
- 入口：`app/`
- 职责：
  - 渲染基金看板、估值历史与配置界面
  - 提供 `/alert-config` 趋势提醒配置页
  - 暴露提醒配置、估值历史与订阅同步相关 API Route

### Worker

- 入口：`worker/index.mjs`
- 依赖模块：`app/lib/alert/*.mjs`
- 职责：
  - 每分钟采样 benchmark ETF 最新价格
  - 聚合 60 分钟伪 K（`10:30 / 11:30 / 14:00 / 15:00` 收线）
  - 计算 EMA、DMI/ADX、回踩锚点与趋势事件
  - 将 `ENTRY / EXIT / SETUP_INVALIDATED` 落库，并在需要时推送飞书

### 数据层

- PostgreSQL：
  - 存储提醒配置、采样数据、伪 K、信号事件与通知日志
  - 表结构由 `app/lib/alert/db.mjs` 在启动时确保存在
- Supabase：
  - 负责用户登录和云端同步
  - 相关 SQL 见 [sql/supabase.sql](sql/supabase.sql)

## 核心目录

```text
app/
|-- api/                  # Next.js Route Handlers
|-- alert-config/         # 趋势提醒配置页面
|-- lib/
|   |-- alert/            # 提醒配置、引擎、worker、通知
|   `-- valuation/        # 估值抓取与历史查询
`-- page.jsx              # 主看板页面

worker/
`-- index.mjs             # worker 进程入口

deploy/
|-- Dockerfile
`-- docker-compose.yml
```

## 趋势提醒数据流

1. 用户在 `/alert-config` 中维护 `strategy_profile` 与 `fund_binding`
2. worker 在交易时段每分钟采样 benchmark ETF，并写入 `etf_sample_1m`
3. 到达 60 分钟收线时，worker 聚合 `etf_bar`
4. `engine.mjs` 在最新 60m bar 上执行趋势状态机：
   - 判断趋势是否成立（`close > EMA20 > EMA60`、`EMA60` 上行、`ADX` 达标、`+DI > -DI`）
   - 在最近若干根 bar 中寻找回踩 `EMA20` 且仍站稳 `EMA60` 的 pullback anchor
   - 若当前 bar 重新走强，则生成 `ENTRY`
   - 若已持仓且连续跌破 `EMA60` 或跌破近期通道低点，则生成 `EXIT`
   - 若 setup 在确认前失效，则生成 `SETUP_INVALIDATED`
5. worker 将事件写入 `signal_event`
6. 若事件类型为 `ENTRY` 或 `EXIT`，则通过 Feishu webhook 推送，并将请求/响应记录到 `notify_log`

## 主要表

- `strategy_profile`：趋势参数模板
- `fund_binding`：目标基金与 benchmark ETF 绑定关系
- `etf_sample_1m`：1 分钟采样点
- `etf_bar`：60 分钟伪 K
- `signal_event`：趋势状态事件（`ENTRY / EXIT / SETUP_INVALIDATED`）
- `notify_log`：飞书通知审计日志
- `fund_valuation_subscription`：登录用户订阅的估值采样基金
- `fund_valuation_sample_1m`：基金估值采样历史

## 当前设计取舍

- 提醒系统只做 long-only 趋势提醒，不做自动交易与做空逻辑
- 只使用 benchmark ETF 作为信号源，目标基金本身不参与趋势判定
- `SETUP_INVALIDATED` 只落库，不发送飞书，避免噪音提醒
- worker 启动时会重建 `signal_event` / `notify_log` 表结构，不兼容旧的三段式提醒语义

