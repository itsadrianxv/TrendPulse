# Real-time Fund

[![Pages](https://github.com/maroonxv/real-time-fund/actions/workflows/nextjs.yml/badge.svg)](https://github.com/maroonxv/real-time-fund/actions/workflows/nextjs.yml)
[![Docker CI](https://github.com/maroonxv/real-time-fund/actions/workflows/docker-ci.yml/badge.svg)](https://github.com/maroonxv/real-time-fund/actions/workflows/docker-ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL%20v3-blue.svg)](LICENSE)

一个面向基金投资场景的 Next.js 应用，集成了实时估值看板、持仓收益记录、云同步、盘中估值历史，以及基于 `worker + PostgreSQL + Feishu webhook` 的日频提醒能力。

## 功能概览

- 实时拉取基金估值、净值、重仓股与盘中涨跌信息。
- 支持自选、分组、持仓、定投和交易记录等个人看盘能力。
- 提供 OCR 导入、移动端适配、列表/卡片双视图等使用体验优化。
- 通过 Supabase 支持登录、云端配置同步与订阅管理。
- 提供盘中估值历史采样与 `/api/valuation/history` 接口。
- 提供 `/alert-config` 配置中心，可管理提醒策略模板与基金绑定关系。
- 可通过 Docker Compose 启动 `web + worker + postgres` 的完整部署形态。

## 技术栈

- 前端与服务端：Next.js 16、React 18、App Router
- 数据与同步：PostgreSQL、Supabase
- 提醒链路：Node.js worker、Feishu webhook
- 可视化与交互：Chart.js、Framer Motion、Tesseract.js
- 自动化：GitHub Actions、Docker Compose

## 仓库结构

```text
.
|-- app/                  # Next.js 页面、组件、API Route、业务库
|-- deploy/               # Dockerfile、docker-compose 与部署环境变量示例
|-- docs/                 # 架构、部署、SQL 与方案文档
|-- public/               # 静态资源
|-- worker/               # 后台提醒 worker 入口
|-- .github/              # CI、Issue/PR 模板、仓库协作配置
|-- .env.example          # 本地开发环境变量示例
|-- CONTRIBUTING.md       # 贡献指南
|-- SECURITY.md           # 安全策略
`-- README.md             # 项目总览
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

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 登录与云同步
   - `SUPABASE_SERVICE_ROLE_KEY`：服务端校验订阅同步接口时使用
   - `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`：反馈表单
   - `NEXT_PUBLIC_GA_ID`：Google Analytics
   - `NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL`：版本提醒接口
   - `DATABASE_URL`：提醒 worker 与盘中估值历史采样所用 PostgreSQL
   - `FEISHU_WEBHOOK_URL`：日频提醒推送地址

4. 启动开发服务器

   ```bash
   npm run dev
   ```

5. 打开页面

   - 首页：`http://localhost:3000`
   - 提醒配置：`http://localhost:3000/alert-config`

### 启动提醒 worker

当你需要启用基金日频提醒或盘中估值采样时，先准备好 PostgreSQL，再执行：

```bash
npm run worker
```

worker 会自动建表并按分钟轮询；若暂时不想运行，可将 `ENABLE_ALERT_WORKER=false`。

## Docker 部署

完整部署依赖 `deploy/` 目录中的编排文件：

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

默认会启动：

- `web`：Next.js Web 与 API
- `worker`：提醒与采样任务
- `postgres`：提醒配置与采样数据存储

停止并清理：

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

## 文档导航

- [docs/README.md](docs/README.md)：文档入口与索引
- [docs/architecture.md](docs/architecture.md)：运行时架构与数据流
- [docs/deployment.md](docs/deployment.md)：本地开发、Docker 与 CI 部署说明
- [docs/plans/fund-daily-alert-v1.md](docs/plans/fund-daily-alert-v1.md)：日频提醒方案设计
- [docs/plans/fund-daily-alert-v1-api.md](docs/plans/fund-daily-alert-v1-api.md)：提醒配置 API 约定
- [docs/sql/supabase.sql](docs/sql/supabase.sql)：Supabase 配置表 SQL

## 参与贡献

欢迎贡献代码、文档与产品建议。开始之前请先阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- [SECURITY.md](SECURITY.md)

## 免责声明

本项目依赖公开数据源，数据可能存在延迟、缺失或口径差异，仅供学习、研究与个人参考，不构成任何投资建议。

## 许可证

本项目采用 [GNU Affero General Public License v3.0](LICENSE) 开源。
