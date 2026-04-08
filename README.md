# TrendPulse

TrendPulse 是一个面向基金估值序列的无头 Node.js 守护进程：按分钟采样，合成固定 `60m` K 线，计算指标，基于一套固定的趋势回踩再起策略产出 `ENTRY`、`EXIT`、`SETUP_INVALIDATED` 事件，并把 `ENTRY` / `EXIT` 推送到飞书。

## 核心交易逻辑

README 的核心就是这套策略规则。策略只在“当前这根已完成的 60m bar”上评估，且所有条件都是固定规则，不做动态参数切换。

### 1. 趋势成立

当前 bar 必须同时满足：

- `close > EMA20 > EMA60`
- `EMA60[t] > EMA60[t-3]`
- `ADX(14) >= 20`
- `+DI > -DI`

只有趋势成立，才允许继续看回踩和再起。

### 2. 回踩锚点

回踩锚点定义固定为：

- 在当前 bar 之前最近 `4` 根已完成 `60m` bar 中，从近到远寻找
- 取最近一根满足 `low <= EMA20 * (1 + 0.003)` 且 `close >= EMA60` 的 bar
- 这根 bar 就是本次 pullback 的唯一锚点

补充约束：

- 同一个回踩锚点只能触发一次 `ENTRY`
- 一旦某个锚点已经被消费，后续 bar 不允许重复用它再次发 `ENTRY`

### 3. 再起确认

当前 bar 必须同时满足：

- `close > 前一根 high`
- `close > 当前 EMA20`
- `close > open`

只有“趋势成立 + 有有效回踩锚点 + 再起确认”三者同时满足，才算命中入场。

### 4. ENTRY 触发规则

当三项入场条件同时成立时：

- 上一个仓位状态为 `FLAT`，发 `ENTRY`，并写 `payload.entry_mode = "INITIAL"`
- 上一个仓位状态为 `LONG`，只有在出现新的回踩锚点且距离上一次 `ENTRY` 至少 `2` 根 bar 时，才再次发 `ENTRY`，并写 `payload.entry_mode = "ADD"`
- 同一个回踩锚点只能触发一次 `ENTRY`，后续 bar 不得重复发

### 5. EXIT 触发规则

`EXIT` 固定为二选一，命中任一条件立即退出：

- 连续 `2` 根收盘价低于 `EMA60`
- 当前收盘价跌破前 `10` 根已完成 bar 的最低 `low`

### 6. SETUP_INVALIDATED 规则

如果已经识别出回踩锚点，但在再起确认之前，当前 bar 出现以下任一情况：

- `close < EMA60`
- `+DI <= -DI`

则发出 `SETUP_INVALIDATED` 事件。这个事件只落库，不发飞书。

### 7. 同 bar 优先级

同一根 bar 上如果同时满足 `EXIT` 和 `ENTRY`：

- 以 `EXIT` 为准
- 当根 bar 不允许反手再发 `ENTRY`
- 重新入场至少等下一根新 bar，再按正常规则重新评估

## 事件与状态语义

- 仓位状态只有两种：`FLAT`、`LONG`
- 策略事件只有三种：`ENTRY`、`EXIT`、`SETUP_INVALIDATED`
- `ENTRY` 额外区分 `INITIAL` 与 `ADD`
- `SETUP_INVALIDATED` 和 `EXIT` 都会清空当前待确认锚点
- 飞书只发送 `ENTRY` 和 `EXIT`；`SETUP_INVALIDATED` 仅写入 SQLite

## 运行时数据流

1. 交易时段内，每分钟采样一次已启用基金的实时估值。
2. 把 `1m` 样本写入 SQLite。
3. 在固定窗口 `10:30`、`11:30`、`14:00`、`15:00` 合成一根完成的 `60m` bar。
4. 基于已完成 bar 计算 `EMA20`、`EMA60`、`ADX(14)`、`+DI`、`-DI`。
5. 对当前 bar 按上面的固定顺序评估 `SETUP_INVALIDATED`、`EXIT`、`ENTRY`。
6. 持久化 `strategy_state`、`strategy_event`、`notify_log`。
7. 对 `ENTRY` / `EXIT` 发送飞书通知。

## 运行环境

- Node.js `>= 20.9.0`
- JSON 配置文件：`config/fund-alert.json`
- SQLite 运行库：默认 `config/var/fund-alert.db`
- Ubuntu 24.04 + `systemd` 部署

## 常用命令

```bash
npm install
npm run config:validate -- --config ./config/fund-alert.example.json
npm run daemon:once -- --config ./config/fund-alert.example.json
npm run state -- --config ./config/fund-alert.example.json --fund 161725
npm run daemon -- --config ./config/fund-alert.json
bash scripts/reapply-server.sh
```

## 配置说明

先复制示例配置：

```bash
cp config/fund-alert.example.json config/fund-alert.json
```

`funds[].shares` 只用于初始化启动时的仓位状态：

- `shares > 0` => `LONG`
- `shares <= 0` => `FLAT`

守护进程不会把运行中的仓位状态反写回 JSON。

## 测试

```bash
npm test
```

## 部署

部署方式见 [docs/deployment.md](docs/deployment.md)。
