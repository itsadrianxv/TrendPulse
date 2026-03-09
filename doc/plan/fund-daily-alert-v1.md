# 基金日频量化提醒系统 V1（Coding Agent 实施方案）

> 更新时间：2026-03-07  
> 面向读者：Coding Agent（可直接按本文实施）

## 1. 项目定位与硬约束

### 1.1 目标
- 构建一个仅用于择时信号提醒的系统（不下单、不对接交易 API）。
- 对每只目标公募基金绑定一个驱动标的（优先 ETF 代理指数），按日频输出提醒。
- 日内使用更小周期（由分钟采样聚合形成的伪K线）提高日频信号判断质量。

### 1.2 明确不做
- 不做自动交易执行。
- 不做反向标的/反向 ETF 对冲逻辑。
- 不讨论交易执行层细节（如下单幂等、防重复下单、通道重试风控等）。

### 1.3 本方案硬约束（必须满足）
1. 方案面向 coding agent，必须有明确交付物与验收标准。
2. 部署必须使用 Docker（至少 `web + worker + postgres`）。
3. 配置必须可配置化：
   - 交易基金及其标的指数基金映射可配置；
   - 策略参数可配置；
   - 飞书 `webhook_url` 从 `.env` 读取，并同步到 `.env.example`。

---

## 2. 配置化设计（新增要求）

### 2.1 配置优先级
`fund_binding.params_override_json > strategy_profile.params_json > 代码默认值`

### 2.2 基金映射配置（可配置）
表：`fund_binding`
- `target_fund_code`（唯一）
- `target_fund_name`
- `benchmark_fund_code`（标的指数基金/ETF，可配置）
- `benchmark_fund_name`
- `enabled`
- `strategy_profile_id`
- `params_override_json`
- `created_at`
- `updated_at`

### 2.3 策略参数配置（可配置）
表：`strategy_profile`
- `id`
- `name`
- `params_json`
- `enabled`
- `created_at`
- `updated_at`

`params_json` 示例：
```json
{
  "macd_fast": 12,
  "macd_slow": 26,
  "macd_signal": 9,
  "td_mode": "TD8",
  "pivot_left": 2,
  "pivot_right_confirm": 2,
  "pivot_right_preview": 0,
  "min_sep_bars": { "15m": 8, "30m": 4, "60m": 2 },
  "eps_price": 0.001,
  "eps_diff_std_window": 60,
  "eps_diff_std_mul": 0.10,
  "pre_alert_time": "14:50",
  "exec_alert_time": "14:58",
  "review_time": "15:00"
}
```

---

## 3. 策略规则（核心）

### 3.1 偏多买入（15/30/60）

#### A. 钝化 + TD低8
- 条件：价格创新低；`DIFF` 相对邻谷/隔谷不创新低（钝化）；出现 TD低8。
- 动作：买入提醒/加仓提醒。
- 退出：
  - 止盈：TD高8 或 `DIFF` 顶背离；
  - 止损：`DIFF` 创更低（钝化失效）。

#### B. 底背离
- 条件：钝化后下一根K线收盘价高于前一根（背离确认）。
- 动作：买入提醒或继续偏多提醒。
- 退出：
  - 止盈：TD高8 或 `DIFF` 再次钝化；
  - 止损：`DIFF` 创更低。

### 3.2 偏空减仓（15/30/60）

#### A. 钝化 + TD高8
- 条件：价格创新高；`DIFF` 相对邻峰/隔峰不创新高（钝化）；出现 TD高8。
- 动作：减仓提醒。
- 退出：
  - 止盈：TD低8 或 `DIFF` 底背离；
  - 止损：`DIFF` 创更高（钝化失效）。

#### B. 顶背离
- 条件：钝化后下一根K线收盘价低于前一根。
- 动作：减仓/进一步减仓提醒。
- 退出：
  - 止盈：TD低8 或 `DIFF` 再次钝化；
  - 止损：`DIFF` 创更高。

---

## 4. 工程化定义（V1定稿）

### 4.1 基础口径
- 创新高低使用 `high/low`。
- MACD 使用标准参数 `(12,26,9)`，比较对象为 `DIFF`。
- TD 统一为 `TD8`：基于 `close[t]` 与 `close[t-4]` 的连续计数。

### 4.2 拐点与邻峰/隔峰
- 收盘确认拐点：分型窗口 `L=2, R=2`。
- 盘中预判拐点：`L=2, R=0`（临时拐点，仅供预警）。
- 邻峰/邻谷：最近一个同类已确认拐点。
- 隔峰/隔谷：倒数第二个同类已确认拐点。

### 4.3 最小间隔与容差
- 最小间隔（约等效 2 小时）：
  - `15m=8根`
  - `30m=4根`
  - `60m=2根`
- `eps_price = 0.10%`（创新高/低需超出该阈值）
- `eps_diff = 0.10 * std(DIFF, 60)`（按各周期独立计算）

### 4.4 钝化与背离判定
- 底钝化：价格创新低，且 `DIFF_t >= min(DIFF邻谷, DIFF隔谷) - eps_diff`
- 顶钝化：价格创新高，且 `DIFF_t <= max(DIFF邻峰, DIFF隔峰) + eps_diff`
- 底背离确认：钝化后下一根 `close[t+1] > close[t]`
- 顶背离确认：钝化后下一根 `close[t+1] < close[t]`

---

## 5. 多周期合成规则（硬条件）

定义：
- `A = 钝化 + TD8`
- `B = A 后背离确认`

### 5.1 买入方向
- 买入预警（14:50）：`A_60 AND (A_30 OR B_30) AND A_15`
- 买入执行提醒（14:58）：`A_60 AND B_30 AND (B_15 OR A_15)` 且无失效（30/60m 的 DIFF 未创更低）

### 5.2 减仓方向
- 减仓预警（14:50）：`A_60 AND (A_30 OR B_30) AND A_15`（镜像条件，方向改为空）
- 减仓执行提醒（14:58）：`A_60 AND B_30 AND (B_15 OR A_15)` 且无失效（30/60m 的 DIFF 未创更高）

---

## 6. 日内提醒时序（09:31~15:00）

### 6.1 每分钟任务
- `09:31`：初始化当日运行上下文。
- `09:31~11:30`、`13:01~14:59`：
  - 采样驱动 ETF 最新价（1m）
  - 更新 15/30/60 伪K
  - 在周期收线点更新指标与信号要素
- `11:31~12:59`：午休仅保活监控。

### 6.2 关键时点
- `14:50`：发送**预警**（仅候选，待 14:58 复核）
  - 数据口径仅使用已收线K：
    - 15m 最多到 14:45
    - 30m 最多到 14:30
    - 60m 最多到 14:00
- `14:58`：发送**执行提醒**（15:00 前有效）
- `15:00`：收盘口径输出**复盘结论**（成立/失效 + 原因）

### 6.3 周期收线点
- `15m`：09:45, 10:00, 10:15, 10:30, 10:45, 11:00, 11:15, 11:30, 13:15, 13:30, 13:45, 14:00, 14:15, 14:30, 14:45, 15:00
- `30m`：10:00, 10:30, 11:00, 11:30, 13:30, 14:00, 14:30, 15:00
- `60m`：10:30, 11:30, 14:00, 15:00

---

## 7. Docker 部署（必须）

### 7.1 服务结构
- `web`：Next.js 页面 + 配置 API。
- `worker`：每分钟调度采样、聚合伪K、判定信号、调用飞书 webhook。
- `postgres`：配置、采样、K线、信号、通知日志持久化。

### 7.2 compose 约束
1. `web` 与 `worker` 使用同一镜像，不同启动命令。
2. `web` 与 `worker` 通过 `env_file: .env` 读取环境变量。
3. `worker` 依赖 `postgres`。
4. `postgres` 使用 volume 持久化。

---

## 8. 环境变量（.env / .env.example）

### 8.1 必需变量
- `FEISHU_WEBHOOK_URL`：飞书机器人 webhook 地址（运行时读取，禁止硬编码）。

### 8.2 建议变量
- `ALERT_TIMEZONE=Asia/Shanghai`
- `ENABLE_ALERT_WORKER=true`

### 8.3 规则
1. `.env.example` 必须包含 `FEISHU_WEBHOOK_URL=` 占位。
2. 若保留 `env.example`，应与 `.env.example` 同步。

---

## 9. 数据表草案（MVP）

1. `fund_binding`：交易基金与标的指数基金映射。
2. `strategy_profile`：策略参数模板。
3. `etf_sample_1m`：1分钟采样点。
4. `etf_bar`：15/30/60 伪K。
5. `signal_event`：PRE/EXEC/REVIEW 事件。
6. `notify_log`：飞书推送审计。

---

## 10. 编码任务拆解（给 coding agent）

1. 配置层：实现运行时参数合并（默认值 + 策略模板 + 单基金覆盖）。
2. 数据层：落表与索引，支持基金映射与策略配置的增删改查。
3. worker 层：分钟采样、聚合、策略判定、三阶段提醒。
4. 通知层：读取 `process.env.FEISHU_WEBHOOK_URL` 发送飞书。
5. 部署层：完善 `docker-compose.yml` 使三服务可一键运行。

---

## 11. 验收标准（Done Definition）

1. 可通过配置增删基金映射，不改代码即可生效。
2. 可通过配置调整策略阈值与时点，worker 自动读取。
3. `.env` 设置 `FEISHU_WEBHOOK_URL` 后可正常推送。
4. `.env.example`（及 `env.example`）已包含 `FEISHU_WEBHOOK_URL=`。
5. Docker 可一键启动 `web + worker + postgres`。
