# 架构总览

## 运行时角色

### Web

- 技术栈：Next.js App Router
- 目录入口：`app/`
- 职责：
  - 渲染基金看板、持仓、定投、分组与设置界面
  - 提供 `/alert-config` 配置页
  - 暴露提醒配置、估值历史、订阅同步等 API Route

### Worker

- 目录入口：`worker/index.mjs`
- 依赖模块：`app/lib/alert/*.mjs`
- 职责：
  - 按分钟采样基金估值与基准 ETF 价格
  - 聚合 15m/30m/60m 伪 K
  - 计算预警、执行、复盘三个阶段的提醒信号
  - 通过 Feishu webhook 发送通知

### 数据层

- PostgreSQL：
  - 存储提醒配置、采样数据、信号事件与通知日志
  - 表结构由 `app/lib/alert/db.mjs` 自动确保存在
- Supabase：
  - 负责用户登录与云端配置同步
  - SQL 基础见 [sql/supabase.sql](sql/supabase.sql)

## 核心目录

```text
app/
|-- api/                  # Next.js Route Handlers
|-- components/           # UI 组件与弹窗
|-- hooks/                # 前端 hooks
|-- lib/
|   |-- alert/            # 提醒系统数据层、计算引擎、通知器
|   `-- valuation/        # 估值抓取与序列能力
|-- alert-config/         # 提醒配置页
`-- page.jsx              # 主看盘页面

worker/
`-- index.mjs             # worker 进程入口

deploy/
|-- Dockerfile
`-- docker-compose.yml
```

## 关键数据流

### 基金看板

1. 用户在首页添加基金。
2. 前端通过 `app/api/fund.js` 聚合公开数据源。
3. 基金、自选、分组、持仓等状态优先保存在 localStorage。
4. 如果用户已登录，则通过 Supabase 进行云端同步。

### 盘中估值历史

1. 用户登录后，前端把订阅基金列表同步到 `/api/valuation/subscriptions/sync`。
2. worker 定时采样已订阅基金的估值并写入 PostgreSQL。
3. 页面通过 `/api/valuation/history` 读取指定基金在某个交易日的采样点。

### 基金日频提醒

1. 在 `/alert-config` 中维护策略模板与基金绑定。
2. worker 读取配置后采样基准 ETF，聚合不同周期的伪 K。
3. `engine.mjs` 根据 MACD、TD 与背离规则计算信号。
4. 命中条件后写入 `signal_event`，再通过 Feishu 推送，并记录 `notify_log`。

## 主要表

- `strategy_profile`：提醒策略模板
- `fund_binding`：目标基金与基准 ETF 的绑定关系
- `etf_sample_1m`：1 分钟采样点
- `etf_bar`：15m/30m/60m 伪 K
- `signal_event`：提醒阶段事件
- `notify_log`：通知审计日志
- `fund_valuation_subscription`：登录用户订阅的估值采样基金
- `fund_valuation_sample_1m`：基金估值历史采样

## 当前设计取舍

- GitHub Pages 适合纯静态页面发布；提醒配置、历史采样和 worker 功能需要完整服务端部署。
- 表结构由应用启动时自动建表，便于快速落地；若后续进入多人协作阶段，建议补充正式迁移机制。
- 仓库维持单应用结构，而不是拆分成 monorepo，以降低当前维护成本。
