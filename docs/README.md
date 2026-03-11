# 文档中心

这个目录用于集中存放仓库的架构说明、部署说明、SQL 文件和产品方案文档，避免关键信息散落在根目录或历史计划文件中。

## 阅读顺序

1. [README.md](../README.md)：先了解项目定位、能力边界和快速开始方式。
2. [architecture.md](architecture.md)：查看运行时架构、关键目录与数据流。
3. [deployment.md](deployment.md)：根据目标环境选择本地开发或 Docker 部署方式。
4. 进入 `plans/`、`sql/`、`data/` 查看专项文档。

## 文档索引

### 通用说明

- [architecture.md](architecture.md)：Web、Worker、数据库与同步链路的整体结构。
- [deployment.md](deployment.md)：环境变量、开发方式、Docker 编排与 CI 说明。

### 数据与存储

- [data/local-storage-schema.md](data/local-storage-schema.md)：前端 localStorage 数据结构说明。
- [sql/supabase.sql](sql/supabase.sql)：Supabase `user_configs` 表与相关函数。
- [sql/fund-daily-alert-v1.sql](sql/fund-daily-alert-v1.sql)：提醒系统 V1 数据表草案。

### 方案与 API

- [plans/fund-daily-alert-v1.md](plans/fund-daily-alert-v1.md)：基金日频提醒系统方案。
- [plans/fund-daily-alert-v1-api.md](plans/fund-daily-alert-v1-api.md)：提醒配置 API 设计。

## 目录约定

- `data/`：客户端存储结构、导入导出格式等数据文档。
- `plans/`：产品方案、接口草案、需求拆解。
- `sql/`：可以直接落库或作为迁移参考的 SQL 文件。
