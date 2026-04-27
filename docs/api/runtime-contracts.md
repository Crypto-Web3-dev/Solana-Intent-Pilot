# SIP 运行时契约总表

## 1. 目标

本文件汇总 SIP MVP 阶段最重要的运行时对象和跨模块契约，作为实现 `shared/` 类型、编排逻辑和 UI 消费层的统一参考。

它不替代已有专题文档，而是把最关键的契约集中到一处，避免实现时在多份文档之间来回拼接。

## 2. 适用范围

本文件覆盖以下运行时对象：

- 页面感知快照
- `SIPIntent` / `SIPAction` 协议
- 风险报告
- 执行预览
- 工作流状态消息
- 关键运行时枚举

不覆盖：

- Prompt 设计细节
- Rust 内部实现细节
- 外部 API 的完整 HTTP 字段

## 3. 设计原则

- 所有契约都必须可序列化
- `Background` 是唯一主编排层
- `Side Panel` 只消费稳定对象，不拼装底层响应
- 同一语义只保留一个权威类型，不允许 UI 和编排层各自定义半兼容结构
- 所有对象优先服务于 MVP 的“可校验、可解释、可演示”
- `actions / bundle` 是当前权威执行模型，文档和代码都必须围绕它对齐

## 4. 关键枚举

### 4.1 Intent 类型

```ts
export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";
```

MVP 规则：

- 当前只真正执行 `SWAP`
- 其它值保留为后续扩展位，不应进入真实执行链

### 4.2 金额模式

```ts
export type AmountMode = "exact" | "half" | "all";
```

### 4.3 请求模式

```ts
export type SIPIntentMode = "SINGLE" | "ATOMIC_BUNDLE";
```

说明：

- `SINGLE`: 当前请求只包含一个动作
- `ATOMIC_BUNDLE`: 当前请求包含多个需要按同一工作流协同处理的动作

### 4.4 动作状态

```ts
export type SIPActionStatus = "pending" | "ready" | "failed";
```

说明：

- `pending`: 动作已生成，但下游执行产物尚未就绪
- `ready`: 动作已拿到继续执行所需的中间产物
- `failed`: 动作在请求内部流程中失败

### 4.5 工作流状态

```ts
export type WorkflowPhase =
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

补充规则：

- `unknown` 是风险标签，不是工作流状态
- `needsClarification` 是 Intent 元数据，不是工作流状态

### 4.6 工作流原因

```ts
export type WorkflowReason =
  | "context-refresh"
  | "intent-invalid"
  | "clarification-required"
  | "risk-blocked"
  | "risk-check-failed"
  | "quote-failed"
  | "simulation-failed"
  | "unsupported-page"
  | "signature-cancelled"
  | "submit-failed"
  | "confirmed";
```

### 4.7 风险等级

```ts
export type RiskLevel = "low" | "medium" | "high" | "unknown";
```

## 5. 页面感知契约

```ts
export interface TokenHint {
  symbol?: string;
  mint?: string;
  source: "twitter" | "birdeye" | "dexscreener" | "generic";
  confidence: number;
}

export interface DetectedContextSnapshot {
  tabId: number;
  url: string;
  title: string;
  selectedText?: string;
  detectedTokens: TokenHint[];
  rawHints: string[];
  detectedAt: string;
}
```

约束：

- 页面内容只提供候选线索，不直接决定交易对象
- `detectedTokens` 中的 `mint` 可缺失，但下游执行对象不可缺失
- `detectedAt` 应使用稳定时间格式，便于调试和排序

## 6. Intent 契约

### 6.1 动作负载

当前 MVP 只定义可执行的 `SWAP` 动作负载：

```ts
export interface SwapActionPayload {
  inputMint: string;
  outputMint: string;
  amount: string;
  amountMode: AmountMode;
  slippageBps: number;
  platform: string;
  userPublicKey?: string;
}
```

约束：

- `outputMint` 不允许用空字符串占位
- `inputMint === outputMint` 时应视为无效 intent
- `amount` 必须使用可跨边界传输的字符串表示

### 6.2 澄清负载

```ts
export type ClarificationKind =
  | "missing-output-mint"
  | "unknown-output-mint"
  | "ambiguous-output-mint"
  | "underspecified-request";

export interface ClarificationPayload {
  kind: ClarificationKind;
  message: string;
  candidateSymbols?: string[];
}
```

### 6.3 SIPAction

```ts
export interface SIPAction {
  id: string;
  type: IntentType;
  payload: SwapActionPayload;
  status: SIPActionStatus;
}
```

MVP 规则：

- 当前真实执行链只消费 `type = "SWAP"` 的动作
- 其它动作类型可保留在结构中用于未来扩展或展示，但不应进入真实执行链

### 6.4 SIPIntent

```ts
export interface SIPIntent {
  intentId: string;
  actions: SIPAction[];
  mode: SIPIntentMode;
  metadata: {
    strategyGoal: string;
    estimatedNetChange?: unknown;
    jitoTipLamports: number;
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
    clarification?: ClarificationPayload;
  };
}
```

关键约束：

- Intent 必须先通过结构和业务校验，再进入执行链
- `actions.length === 0` 时应视为无效 intent
- `needsClarification = true` 时不能进入报价和签名链
- `mode = "SINGLE"` 通常对应一个动作
- `mode = "ATOMIC_BUNDLE"` 表示多个动作属于同一个 `requestId` 的执行请求

## 7. 风险报告契约

```ts
export interface SecurityReport {
  source: "wasm" | "policy-fallback";
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  summary: string;
}
```

关键约束：

- `blocking = true` 时必须至少有一个可解释的失败原因
- `level = "unknown"` 时不得展示为已通过检查
- `policy-fallback` 是允许的显式回退来源，不应伪装成 `wasm`

## 8. 执行预览契约

```ts
export interface ExecutionPreview {
  requestId: string;
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
  simulationSummary?: string;
  swapTransaction?: string;
  bundleTransactions?: string[];
}
```

说明：

- 这是给 UI 直接消费的预览结果对象
- 单动作路径通常使用 `swapTransaction`
- Bundle 路径可使用 `bundleTransactions`
- `simulationSummary` 可以表达成功、失败或降级说明，但不得把失败伪装成已验证成功

关键约束：

- 预览对象必须在签名前可读、可解释
- 报价成功但模拟失败时，不得伪装成可执行预览
- `requestId` 必须和当前工作流保持一致
- `awaiting-signature` 只应在当前预览对象满足签名前最小可解释条件时出现
- 生产默认不允许通过 mock preview、mock intent 或 mock wallet 结果进入真实执行链

## 9. 工作流状态消息契约

```ts
export interface WorkflowStateChangedMessage {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase: WorkflowPhase;
    reason?: WorkflowReason | string;
  };
}
```

关键约束：

- `workflow.state.changed` 是 UI 消费状态的权威来源
- 所有跨状态迁移都应尽量附带 `reason`
- `reason` 优先使用稳定枚举，再回退到自由文本

## 10. 其它关键消息

### 10.1 Intent 请求

```ts
export interface IntentParseRequestedMessage {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
    userPublicKey?: string;
  };
}
```

### 10.2 风险扫描请求

```ts
export interface RiskScanRequestedMessage {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    sourceAction: SIPAction;
  };
}
```

说明：

- 当前风险扫描消息按动作边界传递最小可解释输入
- 不再引用不存在的 `SIPIntent["payload"]`

### 10.3 风险扫描完成

```ts
export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}
```

### 10.4 执行预览完成

```ts
export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
}
```

### 10.5 执行预览失败

```ts
export interface ExecutionPreviewFailedMessage {
  type: "execution.preview.failed";
  payload: {
    requestId: string;
    stage: "quote" | "simulate";
    reason: string;
  };
}
```

### 10.6 钱包签名消息

```ts
export interface ExecutionConfirmedMessage {
  type: "execution.confirmed";
  payload: {
    requestId: string;
  };
}

export interface ExecutionCancelledMessage {
  type: "execution.cancelled";
  payload: {
    requestId: string;
  };
}
```

### 10.7 交易提交消息

```ts
export interface TransactionSubmittedMessage {
  type: "transaction.submitted";
  payload: {
    requestId: string;
    signature: string;
  };
}

export interface TransactionFailedMessage {
  type: "transaction.failed";
  payload: {
    requestId: string;
    reason: string;
  };
}

export interface TransactionSettledMessage {
  type: "transaction.settled";
  payload: {
    requestId: string;
    signature: string;
    explorerUrl?: string;
    settledAt: string;
  };
}
```

## 11. 推荐 shared 类型落点

建议实现时按以下方式组织：

```text
extension/src/shared/
├── context.ts
├── intent.ts
├── risk.ts
├── execution.ts
├── workflow.ts
└── messages.ts
```

## 12. 校验与实现建议

- 先把这些契约落到 `shared/`，再写 `background` 编排
- 不要在 UI 组件 props 里重新发明一套近似类型
- 所有外部返回结果都先映射成本文定义的稳定对象，再传给 UI
- 对同一 `requestId` 的消息流做日志串联，便于调试
- mock 或 fallback 返回的对象也必须遵守本文契约，不得伪装成已验证成功
- 生产默认应将 `mock-services`、mock intent parser、mock wallet provider 限制在 test/dev 显式入口中

## 13. 与其它文档的关系

- 与 [message-types.md](./message-types.md) 对齐消息结构
- 与 [../architecture/workflow-state-machine.md](../architecture/workflow-state-machine.md) 对齐状态与转移
- 与 [ui-state-mapping.md](./ui-state-mapping.md) 对齐 UI 消费语义
- 与 [../security/mvp-risk-policy.md](../security/mvp-risk-policy.md) 对齐风险处理边界
