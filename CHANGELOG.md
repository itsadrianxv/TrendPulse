# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and the project follows semantic versioning when it publishes releases.

## [Unreleased]

### Added

- 新增 `docs/` 文档中心、架构说明与部署说明。
- 新增贡献指南、行为准则、安全策略与变更日志。

### Changed

- 将根目录环境变量示例统一为 `.env.example`。
- 将仓库文档从 `doc/` 迁移到更标准的 `docs/` 目录。
- 重写根 README，使其与当前 `web + worker + postgres` 的实际架构保持一致。

### Fixed

- 修正 `docker-ci` 工作流对 `deploy/Dockerfile` 和 `deploy/docker-compose.yml` 的路径使用。
