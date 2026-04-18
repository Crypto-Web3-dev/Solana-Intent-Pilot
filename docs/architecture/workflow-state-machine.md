# SIP 工作流状态机

## 1. 目标

本文件定义 SIP 在 MVP 阶段的单次请求工作流状态机，作为运行时实现、UI 映射、测试断言和异常处理的统一依据。

它回答四个问题：

- 当前请求一共有多少个正式状态
- 每个状态是怎么进入、怎么退出的
- 哪些异常是“失败”，哪些是“阻断”，哪些只是“需要澄清”
- 哪些数据应该保留，哪些应该清空

## 2. 适用范围

本状态机只描述“单个 `requestId` 的意图执行工作流”，不覆盖：

- 页面感知的长期后台监听
- 钱包连接状态本身
- 全局网络状态或节点健康状态
- 多请求并发调度策略

这些能力可以存在，但都不应破坏单请求状态机的确定性。

## 3. 权威原则

- `Background` 是唯一主编排层
- `workflow.state.changed` 是 UI 消费状态的权威来源
- `Side Panel` 不自己推导下一状态，只渲染状态和发送用户动作
- `unknown` 是风险标签，不是工作流状态
- `needsClarification` 是 Intent 元数据，不是工作流状态

## 4. 状态列表

```ts
type WorkflowPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "risk-checking"
  | "quoting"
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "failed"
  | "blocked";
```

### 4.1 `idle`

含义：

- 当前没有活跃执行中的请求

典型表现：

- 显示空态、最近上下文或最近一次可复用预览

### 4.2 `detecting`

含义：

- 正在更新当前页面上下文

说明：

- 这是页面感知阶段，不代表已经有可执行请求
- 可与 `idle` 相邻出现，但不应覆盖一个已启动请求的核心执行状态

### 4.3 `parsing`

含义：

- 已收到用户输入，正在生成并校验 `SIPIntent`

### 4.4 `risk-checking`

含义：

- Intent 已合法生成，且需要风险扫描

### 4.5 `quoting`

含义：

- 正在获取报价与路由信息

### 4.6 `simulating`

含义：

- 报价已完成，正在模拟签名前结果

### 4.7 `awaiting-signature`

含义：

- 预览已经准备完成，等待用户在钱包中确认签名

### 4.8 `submitting`

含义：

- 已拿到签名，正在向链上提交并等待确认

### 4.9 `confirmed`

含义：

- 交易已成功提交并完成确认，或达到 MVP 认可的成功完成条件

### 4.10 `failed`

含义：

- 流程因为系统错误、外部依赖失败、结构非法或不可恢复异常而终止

典型原因：

- LLM 输出结构无效
- quote 失败
- simulate 失败
- RPC 超时且无可用 fallback

### 4.11 `blocked`

含义：

- 流程因为明确风险规则被策略性阻断

典型原因：

- `Mint Authority` 命中阻断规则
- 综合风险分数达到阻断阈值
- 其它已定义的强阻断规则命中

## 5. 标准转移

### 5.1 Happy Path

```text
idle
  -> parsing
  -> risk-checking
  -> quoting
  -> simulating
  -> awaiting-signature
  -> submitting
  -> confirmed
```

### 5.2 可跳过风险扫描的路径

```text
idle
  -> parsing
  -> quoting
  -> simulating
  -> awaiting-signature
  -> submitting
  -> confirmed
```

条件：

- `requiresRiskScan = false`

### 5.3 页面感知路径

```text
idle
  -> detecting
  -> idle
```

说明：

- `detecting` 用于感知上下文刷新
- 它不是执行链的一部分

## 6. 异常与分支

### 6.1 结构非法

触发条件：

- LLM 输出无法通过 schema 校验

转移：

```text
parsing -> failed
```

要求：

- 保留用户原始输入
- 返回明确错误原因
- 不进入风险、报价和签名链

### 6.2 需要澄清

触发条件：

- Intent 结构合法
- `needsClarification = true`

转移：

```text
parsing -> idle
```

要求：

- 不进入报价、模拟和签名链
- UI 需要保留解析结果摘要和澄清提示
- 不应把它误标记为 `failed`

说明：

- `needsClarification` 是停留在 `idle` 可重新发起的一种“可恢复等待态”
- MVP 阶段不新增单独的 `clarifying` 工作流状态，避免过早膨胀状态机

### 6.3 风险阻断

触发条件：

- 风险扫描命中阻断规则

转移：

```text
risk-checking -> blocked
```

要求：

- 保留风险报告和失败检查项
- 不进入签名链
- UI 明确展示规则原因，而不是仅展示“失败”

### 6.4 报价失败

触发条件：

- quote 获取失败且无可用 fallback

转移：

```text
quoting -> failed
```

要求：

- 保留合法 intent
- 如有风险结果，也应保留
- 允许用户重试

### 6.5 模拟失败

触发条件：

- `simulateTransaction` 返回错误或无法完成

转移：

```text
simulating -> failed
```

要求：

- 不得伪装成可签名成功
- 应保留预览上下文供用户理解失败位置

### 6.6 用户取消签名

触发条件：

- 钱包拒签或用户主动取消

转移：

```text
awaiting-signature -> idle
```

要求：

- 保留最近一次预览卡片
- 不进入 `failed`
- UI 允许用户再次发起确认

### 6.7 提交失败

触发条件：

- 已签名，但提交或确认链路失败

转移：

```text
submitting -> failed
```

要求：

- 展示失败原因和当前已知交易信息
- 避免让 UI 卡在永久提交中

## 7. 状态转移表

| 当前状态 | 触发事件 | 下一个状态 | 备注 |
| --- | --- | --- | --- |
| `idle` | 用户提交输入 | `parsing` | 创建新 `requestId` |
| `idle` | 页面感知刷新 | `detecting` | 非执行链 |
| `detecting` | 上下文更新完成 | `idle` | 返回待输入状态 |
| `parsing` | Intent 合法且需风控 | `risk-checking` | 进入扫描 |
| `parsing` | Intent 合法且无需风控 | `quoting` | 直接进入预览链 |
| `parsing` | 结构非法 | `failed` | 进入解析失败 |
| `parsing` | `needsClarification = true` | `idle` | 保留澄清信息 |
| `risk-checking` | 风控通过 | `quoting` | 进入报价 |
| `risk-checking` | 风控阻断 | `blocked` | 策略性终止 |
| `risk-checking` | 风控调用失败 | `failed` | 系统失败 |
| `quoting` | 报价成功 | `simulating` | 进入模拟 |
| `quoting` | 报价失败 | `failed` | 保留上下文 |
| `simulating` | 模拟成功 | `awaiting-signature` | 等待确认 |
| `simulating` | 模拟失败 | `failed` | 停止执行 |
| `awaiting-signature` | 用户确认签名 | `submitting` | 已拿到签名 |
| `awaiting-signature` | 用户取消签名 | `idle` | 保留预览 |
| `submitting` | 上链确认成功 | `confirmed` | 完成 |
| `submitting` | 提交或确认失败 | `failed` | 终止 |
| `confirmed` | 新请求开始 | `parsing` | 新建 `requestId` |
| `failed` | 用户重试 | `parsing` | 可重发 |
| `blocked` | 用户返回或修改输入 | `idle` | 不开放 override |

## 8. 数据保留规则

### 8.1 必须保留

- `requestId`
- 用户原始输入
- 最近一次合法 `SIPIntent`
- 最近一次风险报告
- 最近一次预览结果
- 最终错误原因或阻断原因

### 8.2 可以清空

- 过期的 loading 状态
- 与旧 `requestId` 绑定的临时动画标记
- 不再可见的中间日志缓存

### 8.3 特殊规则

- `failed` 后不应丢失定位错误所需的数据
- `blocked` 后不应丢失风险明细
- `awaiting-signature -> idle` 时应尽量保留最近预览，便于再次确认

## 9. UI 映射要求

- `failed` 必须区分于 `blocked`
- `needsClarification` 必须区分于 `failed`
- `unknown` 风险标签必须区分于 `high`
- 所有 CTA 状态由工作流状态和风险标签共同决定

推荐规则：

- `blocked`: 主 CTA 禁用，仅允许取消或返回
- `failed`: 允许重试
- `awaiting-signature`: 主 CTA 显示等待签名
- `unknown`: 若策略允许继续，必须附显著提示，不得渲染成通过态

## 10. 实现建议

- 在 `background/workflow-engine.ts` 中维护唯一状态机
- 为每次状态迁移写统一日志，包含 `requestId`、`from`、`to`、`reason`
- 不要让 UI 基于零散事件自行推导状态
- 对 `needsClarification` 使用显式元数据，而不是隐式字段缺失

## 11. 与其它文档的关系

- 与 [runtime-sequence.md](./runtime-sequence.md) 对齐阶段顺序
- 与 [message-flow.md](./message-flow.md) 对齐消息来源和编排职责
- 与 [../api/message-types.md](../api/message-types.md) 对齐状态枚举
- 与 [../api/ui-state-mapping.md](../api/ui-state-mapping.md) 对齐 UI 表现
- 与 [../security/blocking-rules.md](../security/blocking-rules.md) 对齐阻断依据
