# SIP 消息类型定义

## 1. 目标

本文件作为 `message-flow.md` 的配套类型清单，定义扩展内部主要消息的字段边界，方便直接转成 `shared/messages.ts`。

## 2. 基础约束

- 所有消息必须可序列化
- 所有跨上下文异步消息建议带 `requestId`
- `type` 使用稳定字符串常量
- `payload` 中不传递函数、类实例或复杂引用

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
    sourceIntent: SIPIntent["payload"];
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

## 10. 推荐联合类型

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
  | WorkflowStateChangedMessage;
```

## 11. 实现建议

- 将 message 常量和类型放在同一文件
- 为 `chrome.runtime.onMessage` 包一层类型安全 helper
- 所有失败消息都提供 `reason`
- 所有成功消息都优先返回可直接渲染的数据
- `reason` 应尽量使用稳定枚举，避免 UI 依赖自由文本分支判断
