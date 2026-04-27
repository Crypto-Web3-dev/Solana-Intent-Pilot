# SIP 消息类型定义

## 1. 目标

本文件作为 `message-flow.md` 的配套类型清单，定义扩展内部主要消息的字段边界，方便直接转成 `shared/messages.ts`。

## 2. 基础约束

- 所有消息必须可序列化
- 所有跨上下文异步消息建议带 `requestId`
- `type` 使用稳定字符串常量
- `payload` 中不传递函数、类实例或复杂引用
- 当前权威 intent 结构是 `actions / bundle`，消息层不得再假设顶层单一 `payload`

## 3. 基础类型

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

export type SIPIntentMode = "SINGLE" | "ATOMIC_BUNDLE";
export type SIPActionStatus = "pending" | "ready" | "failed";
```

## 4. 页面感知类消息

```ts
export interface ContextDetectedMessage {
  type: "context.detected";
  payload: DetectedContextSnapshot;
}

export interface ContextClearedMessage {
  type: "context.cleared";
  payload: {
    tabId: number;
    clearedAt: string;
  };
}
```

## 5. Intent 工作流消息

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

export interface IntentParseSucceededMessage {
  type: "intent.parse.succeeded";
  payload: {
    requestId: string;
    intent: SIPIntent;
  };
}

export interface IntentParseFailedMessage {
  type: "intent.parse.failed";
  payload: {
    requestId: string;
    reason: string;
    recoverable: boolean;
  };
}
```

## 6. 风险扫描消息

```ts
export interface RiskScanRequestedMessage {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    sourceAction: SIPAction;
  };
}

export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}
```

说明：

- 当前风险扫描请求按动作边界传递最小可信输入
- 若后续需要请求级风险消息，应新增独立消息，不要复用不存在的 `SIPIntent["payload"]`

## 7. 执行预览消息

```ts
export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: {
    requestId: string;
    routeLabel: string;
    inputAmount: string;
    outputAmount: string;
    slippageBps: number;
    estimatedFeeLamports: string;
    simulationSummary?: string;
    swapTransaction?: string;
    bundleTransactions?: string[];
  };
}

export interface ExecutionPreviewFailedMessage {
  type: "execution.preview.failed";
  payload: {
    requestId: string;
    stage: "quote" | "simulate";
    reason: string;
  };
}
```

约束：

- `simulationSummary` 可表达成功、失败或降级说明
- 失败或降级说明不得被 UI 解读为已验证成功

## 8. 交易提交消息

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

## 9. 工作流状态消息

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

## 10. 可选钱包提交消息

```ts
export interface WalletSubmissionRequestedMessage {
  type: "wallet.submission.requested";
  payload: {
    requestId: string;
    intent: SIPIntent;
    preview: ExecutionPreview;
  };
}

export interface WalletSubmissionCompletedMessage {
  type: "wallet.submission.completed";
  payload: {
    requestId: string;
    signature: string;
    explorerUrl?: string;
  };
}

export interface WalletSubmissionFailedMessage {
  type: "wallet.submission.failed";
  payload: {
    requestId: string;
    reason: string;
  };
}
```

## 11. 推荐联合类型

```ts
export type SIPRuntimeMessage =
  | ContextDetectedMessage
  | ContextClearedMessage
  | IntentParseRequestedMessage
  | IntentParseSucceededMessage
  | IntentParseFailedMessage
  | RiskScanRequestedMessage
  | RiskScanCompletedMessage
  | ExecutionPreviewReadyMessage
  | ExecutionPreviewFailedMessage
  | ExecutionConfirmedMessage
  | ExecutionCancelledMessage
  | TransactionSubmittedMessage
  | TransactionFailedMessage
  | TransactionSettledMessage
  | WalletSubmissionRequestedMessage
  | WalletSubmissionCompletedMessage
  | WalletSubmissionFailedMessage
  | WorkflowStateChangedMessage;
```

## 12. 实现建议

- 将 message 常量和类型放在同一文件
- 为 `chrome.runtime.onMessage` 包一层类型安全 helper
- 所有失败消息都提供 `reason`
- 所有成功消息都优先返回可直接渲染的数据
- `reason` 应尽量使用稳定枚举，避免 UI 依赖自由文本分支判断
- 不要用 `as any` 绕过这里定义的消息形状

