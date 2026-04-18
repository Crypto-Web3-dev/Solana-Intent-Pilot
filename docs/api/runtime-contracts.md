# SIP 运行时契约总表

## 1. 目标

本文件汇总 SIP MVP 阶段最重要的运行时对象和跨模块契约，作为实现 `shared/` 类型、编排逻辑和 UI 消费层的统一参考。

它不替代已有专题文档，而是把最关键的契约集中到一处，避免实现时在多份文档之间来回拼接。

## 2. 适用范围

本文件覆盖以下运行时对象：

- 页面感知快照
- Intent 协议
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

说明：

- `exact`: 已有明确原子单位数量
- `half`: 基于余额推导一半
- `all`: 基于余额推导全部

### 4.3 工作流状态

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

### 4.4 工作流原因

```ts
export type WorkflowReason =
  | "context-refresh"
  | "intent-invalid"
  | "clarification-required"
  | "risk-blocked"
  | "risk-check-failed"
  | "quote-failed"
  | "simulation-failed"
  | "signature-cancelled"
  | "submit-failed"
  | "confirmed";
```

说明：

- `reason` 用于解释状态切换原因
- UI 可以展示对应文案，但不应依赖自由文本做分支判断

### 4.5 风险等级

```ts
export type RiskLevel = "low" | "medium" | "high" | "unknown";
```

说明：

- `unknown` 表示数据不足，不能伪装成安全
- `high` 表示高风险或命中明确阻断规则

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

```ts
export interface SIPIntent {
  intent: IntentType;
  confidence: number;
  payload: {
    inputMint: string;
    outputMint: string;
    amount: string;
    amountMode: AmountMode;
    slippageBps: number;
    platform: string;
  };
  metadata: {
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
  };
}
```

关键约束：

- Intent 必须先通过 schema 校验，再进入执行链
- `outputMint` 不允许用空字符串占位
- `needsClarification = true` 时不能进入报价和签名链
- `confidence` 影响 UI 提示，但不能替代结构和业务校验

MVP 推荐业务规则：

- `intent !== "SWAP"` 时只展示解析结果，不进入真实执行链
- `inputMint === outputMint` 时直接视为无效 intent

## 7. 风险报告契约

```ts
export interface SecurityReport {
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

字段语义：

- `score`: 供 UI 和调试使用的综合分值
- `level`: 面向用户展示的风险等级
- `blocking`: 是否阻断当前执行流程
- `checks`: 具体检查项明细
- `summary`: 给 UI 直接展示的摘要

关键约束：

- `blocking = true` 时必须至少有一个可解释的失败原因
- `level = "unknown"` 时不得展示为已通过检查
- `Freeze Authority` 在 MVP 中默认只警告，不单独阻断

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
}
```

说明：

- 这是给 UI 直接消费的预览结果对象
- 可以来源于 Jupiter、simulate 和本地格式化逻辑的组合
- 不要求把底层原始响应全部暴露给 UI

关键约束：

- 预览对象必须在签名前可读、可解释
- 报价成功但模拟失败时，不得伪装成可执行预览
- `requestId` 必须和当前工作流保持一致

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
  };
}
```

### 10.2 风险扫描完成

```ts
export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}
```

### 10.3 执行预览完成

```ts
export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
}
```

### 10.4 交易已提交

```ts
export interface TransactionSubmittedMessage {
  type: "transaction.submitted";
  payload: {
    requestId: string;
    signature: string;
  };
}
```

### 10.5 签名已取消

```ts
export interface ExecutionCancelledMessage {
  type: "execution.cancelled";
  payload: {
    requestId: string;
  };
}
```

### 10.6 交易提交失败

```ts
export interface TransactionFailedMessage {
  type: "transaction.failed";
  payload: {
    requestId: string;
    reason: string;
  };
}
```

### 10.7 交易已确认

```ts
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

推荐职责：

- `context.ts`: `TokenHint`、`DetectedContextSnapshot`
- `intent.ts`: `IntentType`、`AmountMode`、`SIPIntent`
- `risk.ts`: `RiskLevel`、`SecurityReport`
- `execution.ts`: `ExecutionPreview`
- `workflow.ts`: `WorkflowPhase`、`WorkflowReason`
- `messages.ts`: 各类消息接口和联合类型

## 12. 校验与实现建议

- 先把这些契约落到 `shared/`，再写 Background 编排
- 不要在 UI 组件 props 里重新发明一套近似类型
- 所有外部返回结果都先映射成本文定义的稳定对象，再传给 UI
- 对同一 `requestId` 的消息流做日志串联，便于调试

## 13. 与其它文档的关系

- 与 [intent-schema.md](./intent-schema.md) 对齐 Intent 字段和校验要求
- 与 [message-types.md](./message-types.md) 对齐消息结构
- 与 [../security/risk-engine.md](../security/risk-engine.md) 对齐风险报告
- 与 [../architecture/workflow-state-machine.md](../architecture/workflow-state-machine.md) 对齐状态与转移
- 与 [ui-state-mapping.md](./ui-state-mapping.md) 对齐 UI 消费语义
