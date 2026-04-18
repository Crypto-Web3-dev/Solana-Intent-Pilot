# SIP 运行时顺序图

## 1. 目标

本文件描述 SIP 在一次典型用户操作中的运行时顺序，帮助实现时统一：

- 谁先触发谁
- 哪些步骤是同步感知，哪些是异步编排
- 哪些阶段必须等待结果，哪些可以并行

## 2. Happy Path

以下是一次标准 `detect -> parse -> scan -> quote -> simulate -> sign -> submit` 流程：

```text
User
  -> Side Panel: 输入 "买 1 SOL 的这个币"
Side Panel
  -> Background: intent.parse.requested
Background
  -> Context Store: 读取当前 tab 的 context snapshot
Background
  -> LLM Service: parse intent
LLM Service
  -> Background: SIPIntent
Background
  -> Side Panel: workflow.state.changed(parsing -> risk-checking)
Background
  -> RPC Provider: getAccountInfo(outputMint)
RPC Provider
  -> Background: mint account data
Background
  -> Wasm Engine: analyze mint data
Wasm Engine
  -> Background: SecurityReport
Background
  -> Jupiter Adapter: get quote
Jupiter Adapter
  -> Background: best route + output estimate
Background
  -> Execution Adapter: simulate transaction
Execution Adapter
  -> RPC Provider: simulateTransaction
RPC Provider
  -> Background: simulation result
Background
  -> Side Panel: execution.preview.ready
User
  -> Side Panel: 点击确认
Side Panel
  -> Background: execution.confirmed
Background
  -> Wallet Provider: request signature
Wallet Provider
  -> Background: signed transaction
Background
  -> RPC Provider: send transaction
RPC Provider
  -> Background: signature / confirmation
Background
  -> Side Panel: workflow.state.changed(confirmed)
```

## 3. 阶段划分

### 3.1 感知阶段

触发条件：

- 页面加载
- DOM 变化
- 用户选中文本

输出：

- `DetectedContextSnapshot`

特点：

- 可持续后台更新
- 不依赖用户明确触发

### 3.2 解析阶段

触发条件：

- 用户提交自然语言输入

输出：

- `SIPIntent`

特点：

- 必须带 `requestId`
- 必须经过 schema 校验

### 3.3 风控阶段

触发条件：

- `requiresRiskScan = true`

输出：

- `SecurityReport`

特点：

- 默认串行阻塞后续执行预览
- 后续可优化为 quote 与部分 scan 并行，但最终展示前必须会合

### 3.4 预览阶段

触发条件：

- 风险未阻断

输出：

- 报价结果
- 模拟结果
- Action Card

### 3.5 执行阶段

触发条件：

- 用户确认

输出：

- 钱包签名
- 链上提交结果
- 成功或失败状态

## 4. 并行与串行建议

推荐串行：

- `parse -> validate`
- `risk -> block/allow`
- `sign -> submit`

可并行优化：

- 获取 mint data 与获取 quote
- 获取 token metadata 与风险结果渲染准备

但任何并行优化都不能跳过以下门槛：

- intent 校验通过
- 风险检查完成或明确标记可跳过
- 用户最终确认

## 5. 异常路径

### 5.1 LLM 输出无效

- Background 标记 `failed`
- Side Panel 展示“未能解析成可执行意图”
- 保留用户输入，允许重新提交

### 5.2 需要澄清

- Intent 结构合法，但 `needsClarification = true`
- Background 不进入报价、模拟和签名链
- Side Panel 提示用户确认目标资产、金额或条件后重新提交

### 5.3 风险阻断

- Background 标记 `blocked`
- Side Panel 显示高风险说明
- 不进入签名流程

### 5.4 报价或模拟失败

- 保留 intent 和风险结果
- 显示 `quote unavailable` 或 `simulation failed`
- 允许用户重试或切换节点

### 5.5 用户取消签名

- 工作流回到 `idle` 或 `ready`
- 保留最近预览卡片供再次发起

## 6. 实现提醒

- 所有阶段事件都应写入统一 workflow state
- 每个外部调用都应附带超时和错误原因
- UI 不要自己拼时序，应只渲染状态机和结果对象
