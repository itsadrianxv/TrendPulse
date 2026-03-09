# Agent 行为规范

## 自动 Git 提交规则

当你完成以下任何一类操作后，必须自动执行 `git add {修改的文件}`、`git commit -m "<message>"`、`git push`：

1. 修复 bug 或错误（如导入路径修复、运行时报错修复）
2. 新增功能或文件
3. 重构代码（如重命名、移动文件、调整结构）
4. 修改配置文件（如 Dockerfile、pytest.ini、requirements.txt 等）
5. 更新或新增测试
6. 更新文档（如 README、需求文档、AGENTS.md 等）

## Commit 消息格式

使用中文，遵循 Conventional Commits 风格：

```
<type>: <简要描述>

<可选的详细说明>
```

type 取值：
- `fix`: 修复 bug
- `feat`: 新功能
- `refactor`: 重构
- `docs`: 文档变更
- `chore`: 构建/配置/工具变更
- `test`: 测试相关
- `style`: 格式调整（不影响逻辑）

## 注意事项

- 每次操作完成后立即提交，不要积攒多个不相关的变更到一个 commit
- commit 消息要准确描述本次变更内容
- 如果一次用户请求涉及多个不相关的改动，拆分为多个 commit


此项目未部署，请不要考虑任何向后兼容性，直接大胆放心改接口、改schema等


针对领域服务或者基础设施，不要写 facade, coordinator 一类的代码，直接让上层调用具体服务/基础设施即可

### apply_patch 失败兜底（Windows）
- 优先用小 hunk 的 `apply_patch`，避免整文件大替换。
- 若 `apply_patch` 出现 `verification failed` 或无输出的 exit 1，最多再试 1 次，不要反复重试。
- 对整文件重写、含中文、或 CRLF 敏感文件，直接改用 PowerShell 原子写入（`Set-Content -Encoding UTF8` 或 `WriteAllText(UTF8 no BOM)`）。
- 写入后必须用 `git diff` 校验结果。
