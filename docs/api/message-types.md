# SIP Message Type Definitions

## 1. Goal

This document serves as a companion type inventory to `message-flow.md`, defining the field boundaries of major messages within the extension, making it easy to directly convert into `shared/messages.ts`.

## 2. Basic Constraints

- All messages must be serializable
- All cross-context async messages should include `requestId`
- `type` uses stable string constants
- `payload` must not contain functions, class instances, or complex references

## 3. Base Types

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

## 4. Page Awareness Messages

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

## 5. Intent Workflow Messages

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

## 6. Risk Scan Messages

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

## 7. Execution Preview Messages

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

## 8. Transaction Submission Messages

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

## 9. User Action Messages

```ts
export interface ExecutionCancelRequestedMessage {
  type: "execution.cancel.requested";
}

export interface ExecutionRetryRequestedMessage {
  type: "execution.retry.requested";
}
```

## 10. Wallet Submission Messages

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
  };
}

export interface WalletSubmissionFailedMessage {
  type: "wallet.submission.failed";
  payload: {
    requestId: string;
    error: string;
  };
}
```

## 11. Workflow State Messages

```ts
export interface WorkflowStateChangedMessage {
  type: "workflow.state.changed";
  payload: {
    previous: WorkflowPhase;
    current: WorkflowPhase;
    reason?: WorkflowReason;
    intent?: SIPIntent;
    riskReport?: SecurityReport;
    preview?: ExecutionPreview;
  };
}
```

## 12. Union Type

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
  | ExecutionCancelRequestedMessage
  | ExecutionRetryRequestedMessage
  | TransactionSubmittedMessage
  | TransactionFailedMessage
  | TransactionSettledMessage
  | WalletSubmissionRequestedMessage
  | WalletSubmissionCompletedMessage
  | WalletSubmissionFailedMessage
  | WorkflowStateChangedMessage;
```

## 13. Internal Content Script Messages

The content script (`detect-context.ts`) also listens for these trigger messages (not part of `SIPRuntimeMessage`):

- `context.request_scan` — triggers context capture
- `context.snapshot.requested` — triggers instant snapshot

## 14. Implementation Recommendations

- Place message constants and types in the same file
- Wrap `chrome.runtime.onMessage` with a type-safe helper
- All failure messages should provide `reason`
- All success messages should prefer returning directly renderable data
- `reason` should prefer stable enums over free-text to avoid UI relying on free-text branch logic
