# 部署与运行

## 本地开发

### Web 应用

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建本地环境变量：

   ```bash
   cp .env.example .env.local
   ```

3. 启动开发服务器：

   ```bash
   npm run dev
   ```

默认访问地址为 `http://localhost:3000`。

### 提醒 worker

worker 依赖 PostgreSQL。准备好数据库后，确保下列变量可用：

- `DATABASE_URL`
- `FEISHU_WEBHOOK_URL`
- `ALERT_TIMEZONE`
- `ENABLE_ALERT_WORKER`

启动命令：

```bash
npm run worker
```

## Docker Compose

`deploy/docker-compose.yml` 适合运行完整服务。

### 启动

```bash
cp deploy/.env.example deploy/.env
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

### 停止

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env down
```

### 服务说明

- `web`：Next.js 页面与 API，默认映射到 `WEB_PORT`
- `worker`：提醒任务与估值采样
- `postgres`：运行时数据库

## 环境变量

### 根目录 `.env.example`

适用于本地开发与单独运行 Node 进程：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL`
- `FEISHU_WEBHOOK_URL`
- `ALERT_TIMEZONE`
- `ENABLE_ALERT_WORKER`
- `DATABASE_URL`

### `deploy/.env.example`

在根目录变量的基础上，补充容器运行所需的：

- `NODE_IMAGE`
- `POSTGRES_IMAGE`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `WEB_PORT`

## CI 说明

- `.github/workflows/nextjs.yml`：构建并部署 GitHub Pages 版本。
- `.github/workflows/docker-ci.yml`：校验 `deploy/Dockerfile` 与 `deploy/docker-compose.yml`。
- 如果启用了安全工作流，建议同时为仓库开启 Dependabot 和 CodeQL 告警。
