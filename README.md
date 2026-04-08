# Real-time Fund

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-blue.svg)](LICENSE)

一个面向基金投资场景的 Next.js 应用，提供基金看板、估值历史、云端同步，以及基于 `worker + PostgreSQL + Feishu webhook` 的趋势择时提醒。

## 功能概览

- 实时查看基金估值、净值、持仓与收益信息
- 支持自选、分组、定投、交易记录等个人看板能力
- 登录后可通过 Supabase 同步配置与订阅状态
- 提供 `/api/valuation/history` 查询盘中估值采样结果
- 提供 `/alert-config` 配置中心，管理提醒策略模板和基金绑定关系
- 通过 worker 采样 benchmark ETF，生成 60 分钟伪 K，并按趋势策略触发飞书提醒

## 趋势提醒策略

当前提醒系统使用 **60 分钟单级别 long-only 趋势策略**：

- 只使用绑定的 benchmark ETF 作为信号源
- 趋势成立条件：`close > EMA20 > EMA60`、`EMA60` 上行、`ADX` 达标、`+DI > -DI`
- 入场逻辑：趋势中回踩 `EMA20` 后重新走强，触发 `ENTRY`
- 持仓中若出现新的有效回踩 setup，可触发 `ADD`
- 退出逻辑：连续跌破 `EMA60` 或跌破近期通道低点，触发 `EXIT`
- `SETUP_INVALIDATED` 只落库审计，不发送飞书
- 评估时点固定为每个 60 分钟收线：`10:30 / 11:30 / 14:00 / 15:00`

## 技术栈

- 前端与服务端：Next.js 16、React 18、App Router
- 数据与同步：PostgreSQL、Supabase
- 提醒链路：Node.js worker、Feishu webhook
- 图表与交互：Chart.js、Framer Motion、Tesseract.js
- 自动化：Docker Compose

## 仓库结构

```text
.
|-- app/                  # 页面、组件、API Route、业务库
|-- deploy/               # Dockerfile、docker-compose 与部署脚本
|-- docs/                 # 架构、SQL、部署与方案文档
|-- public/               # 静态资源
|-- worker/               # 提醒 worker 入口
|-- .env.example          # 本地环境变量示例
`-- README.md             # 项目概览
```

## 快速开始

### 环境要求

- Node.js `>= 20.9.0`
- npm `>= 10`

### 本地开发

1. 安装依赖

   ```bash
   npm install
   ```

2. 配置环境变量

   ```bash
   cp .env.example .env.local
   ```

3. 按需填写以下变量

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL`
- `DATABASE_URL`
- `FEISHU_WEBHOOK_URL`
- `ALERT_TIMEZONE`（默认 `Asia/Shanghai`）
- `ENABLE_ALERT_WORKER`（默认 `true`）

4. 启动前端

   ```bash
   npm run dev
   ```

5. 启动 worker

   ```bash
   npm run worker
   ```

6. 运行提醒模块测试

   ```bash
   npm test
   ```

### 打开页面

- 首页：`http://localhost:3000`
- 提醒配置：`http://localhost:3000/alert-config`

## Docker 部署

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

默认会启动：

- `web`：Next.js 页面与 API
- `worker`：估值采样与趋势提醒任务
- `postgres`：配置、伪 K、事件与通知日志存储

停止并清理：

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

## 文档导航

- [docs/README.md](docs/README.md)：文档入口
- [docs/architecture.md](docs/architecture.md)：运行时架构与数据流
- [docs/deployment.md](docs/deployment.md)：本地、Docker 与 CI 说明
- [docs/plans/fund-daily-alert-v1.md](docs/plans/fund-daily-alert-v1.md)：60m 趋势提醒方案
- [docs/plans/fund-daily-alert-v1-api.md](docs/plans/fund-daily-alert-v1-api.md)：提醒配置 API 示例
- [docs/sql/fund-daily-alert-v1.sql](docs/sql/fund-daily-alert-v1.sql)：提醒相关表结构

## 免责声明

本项目依赖公开数据源，数据可能存在延迟、缺失或口径差异，仅供学习、研究与个人参考，不构成任何投资建议。

## 许可协议

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 开源。
