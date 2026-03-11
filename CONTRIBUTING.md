# 贡献指南

感谢你愿意为 `real-time-fund` 做贡献。

## 开始之前

- 先阅读 [README.md](README.md) 和 [docs/README.md](docs/README.md)。
- 如果是缺陷修复或功能建议，请优先使用仓库的 Issue 模板。
- 涉及安全问题时，不要公开披露细节，请遵循 [SECURITY.md](SECURITY.md)。

## 本地开发

1. 安装依赖：`npm install`
2. 创建本地配置：`cp .env.example .env.local`
3. 启动开发：`npm run dev`
4. 如需验证提醒链路，准备 PostgreSQL 后运行：`npm run worker`

## 提交规范

- 推荐使用 Conventional Commits，例如：
  - `feat: 增加提醒策略模板筛选`
  - `fix: 修正 docker compose 健康检查路径`
  - `docs: 重写部署说明`
- 保持单次提交聚焦一个主题，避免把不相关改动混在一起。

## 提交 Pull Request 前

- 确保相关代码、文档和配置一起更新。
- 至少运行一次 `npm run lint`。
- 如果修改了部署或提醒链路，请补充必要的验证说明。
- 如果修改了接口、数据结构或行为约定，请同步更新 `docs/` 中对应文档。

## 推荐的贡献范围

- 基金数据展示与交互体验改进
- 提醒策略配置和 worker 稳定性优化
- Docker / CI / 文档完善
- 数据采样、持仓、估值历史相关问题修复

## 不建议直接合并的改动

- 未说明来源的大规模数据文件
- 包含敏感信息的配置文件
- 没有文档说明的重大架构调整
