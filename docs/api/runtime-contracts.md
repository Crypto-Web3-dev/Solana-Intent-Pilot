# SIP Runtime Contracts Summary

## 1. Goal

This document summarizes the most important runtime objects and cross-module contracts for the SIP MVP phase, serving as a unified reference for implementing `shared/` types, orchestration logic, and UI consumption layers.

It does not replace existing specialized documents, but rather concentrates the most critical contracts in one place, avoiding the need to piece together information from multiple documents during implementation.

## 2. Scope

This document covers the following runtime objects:

- Page awareness snapshot
- Intent protocol
- Risk report
- Execution preview
- Workflow state messages
- Key runtime enums

Not covered:

- Prompt design details
- Rust internal implementation details
- Complete HTTP fields of external APIs

## 3. Design Principles

- All contracts must be serializable
- `Background` is the sole primary orchestration layer
- `Side Panel` only consumes stable objects, never assembles raw low-level responses
- Each semantic concept has exactly one authoritative type; UI and orchestration layers must not each define half-compatible structures
- All objects primarily serve the MVP's "verifiable, explainable, demonstrable" goals

## 4. Key Enums

### 4.1 Intent Types

```ts
export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";
```

MVP rules:

- Only `SWAP` is actually executed currently
- Other values are reserved as future extension placeholders and should not enter the real execution chain

### 4.2 Amount Mode

```ts
export type AmountMode = "exact" | "half" | "all";
```

Description:

- `exact`: Has an explicit amount in atomic units
- `half`: Derived as half of the balance
- `all`: Derived as the full balance

### 4.3 Workflow States

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

Additional rules:

- `unknown` is a risk label, not a workflow state
- `needsClarification` is Intent metadata, not a workflow state

### 4.4 Workflow Reasons

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

Description:

- `reason` is used to explain state transition causes
- UI can display corresponding copy, but should not rely on free text for branch logic

### 4.5 Risk Levels

```ts
export type RiskLevel = "low" | "medium" | "high" | "unknown";
```

Description:

- `unknown` indicates insufficient data and must not be disguised as safe
- `high` indicates high risk or a clear blocking rule match

## 5. Page Awareness Contract

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

Constraints:

- Page content only provides candidate clues and does not directly determine transaction targets
- `mint` in `detectedTokens` may be missing, but downstream execution objects must not be missing
- `detectedAt` should use a stable time format for debugging and sorting

## 6. Intent Contract

```ts
interface SIPIntent {
  intentId: string;
  mode: "SINGLE" | "ATOMIC_BUNDLE" | "PARALLEL";
  actions: SIPAction[];
  metadata: SIPIntentMetadata;
}

interface SIPAction {
  id: string;
  type: "SWAP" | "STAKE" | "LEND" | "TRANSFER";
  status: "pending" | "ready" | "failed";
  payload: SIPActionPayload;
}

interface SIPIntentMetadata {
  strategyGoal: string;
  reasoning: string;
  jitoTipLamports: number;
  requiresRiskScan: boolean;
  sourceContext: string[];
  needsClarification: boolean;
  clarification?: ClarificationPayload;
  riskContext?: RiskContext;
}
```

Key constraints:

- Intent must pass schema validation before entering the execution chain
- `outputMint` must not use an empty string as a placeholder
- When `needsClarification = true`, must not enter the quote and signing chain
- `confidence` affects UI prompts but cannot replace structural and business validation

Recommended MVP business rules:

- When action type is not `SWAP`, only display the parsed result without entering the real execution chain
- When `inputMint === outputMint`, treat it as an invalid intent

## 7. Risk Report Contract

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

Field semantics:

- `score`: Composite score for UI and debugging purposes
- `level`: Risk level displayed to the user
- `source`: Whether the current risk result comes from Wasm or policy fallback
- `blocking`: Whether to block the current execution flow (note: Wasm always returns `blocking: false`; the policy layer in `risk-adapter.ts` applies blocking rules on top of the Wasm output)
- `checks`: Detailed individual check items
- `summary`: Summary for direct UI display

Key constraints:

- When `blocking = true`, there must be at least one explainable failure reason (set by the policy layer, not Wasm)
- When `level = "unknown"`, must not be displayed as having passed checks
- `Freeze Authority` in MVP defaults to warning only, does not independently block

## 8. Execution Preview Contract

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

Description:

- This is the preview result object for direct UI consumption
- Can be sourced from a combination of Jupiter, simulation, and local formatting logic
- Does not require exposing all underlying raw responses to the UI

Key constraints:

- Preview objects must be readable and explainable before signing
- When quoting succeeds but simulation fails, must not be disguised as an executable preview
- `requestId` must be consistent with the current workflow

## 9. Workflow State Message Contract

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

Key constraints:

- `workflow.state.changed` is the authoritative source for UI state consumption
- All state transitions should ideally include a `reason`
- `reason` should prefer stable enums, falling back to free text

## 10. Other Key Messages

### 10.1 Intent Request

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

### 10.2 Risk Scan Completed

```ts
export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}
```

### 10.3 Execution Preview Ready

```ts
export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
}
```

### 10.4 Transaction Submitted

```ts
export interface TransactionSubmittedMessage {
  type: "transaction.submitted";
  payload: {
    requestId: string;
    signature: string;
  };
}
```

### 10.5 Signature Cancelled

```ts
export interface ExecutionCancelledMessage {
  type: "execution.cancelled";
  payload: {
    requestId: string;
  };
}
```

### 10.6 Transaction Submission Failed

```ts
export interface TransactionFailedMessage {
  type: "transaction.failed";
  payload: {
    requestId: string;
    reason: string;
  };
}
```

### 10.7 Transaction Confirmed

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

## 11. Recommended shared Type File Layout

It is recommended to organize the implementation as follows:

```text
extension/src/shared/
├── context.ts
├── intent.ts
├── risk.ts
├── execution.ts
├── workflow.ts
├── messages.ts
├── supported-pages.ts
└── demo-mode.ts
```

Recommended responsibilities:

- `context.ts`: `TokenHint`, `DetectedContextSnapshot`
- `intent.ts`: `SIPIntent`, `SIPAction`, `SIPIntentMetadata`, `ClarificationPayload`, `IntentMode`
- `risk.ts`: `RiskLevel`, `RiskEngineSource`, `SecurityReport`, `SecurityCheck`
- `execution.ts`: `ExecutionPreview`
- `workflow.ts`: `WorkflowPhase`, `WorkflowReason`
- `messages.ts`: All message interfaces, `SIPRuntimeMessage` union type
- `supported-pages.ts`: `SUPPORTED_PAGE_MATCHES`, `SUPPORTED_PAGE_REGEXES`, `isSupportedPageUrl()`
- `demo-mode.ts`: Demo mode utilities: Various message interfaces and union types

## 12. Validation and Implementation Recommendations

- Implement these contracts in `shared/` first, then write Background orchestration
- Do not reinvent approximate types in UI component props
- Map all external return results to the stable objects defined in this document before passing to UI
- Log-correlate messages for the same `requestId` for easier debugging

## 13. Relationship to Other Documents

- Aligns with [intent-schema.md](./intent-schema.md) on Intent fields and validation requirements
- Aligns with [message-types.md](./message-types.md) on message structures
- Aligns with [../security/risk-engine.md](../security/risk-engine.md) on risk reports
- Aligns with [../architecture/workflow-state-machine.md](../architecture/workflow-state-machine.md) on states and transitions
- Aligns with [ui-state-mapping.md](./ui-state-mapping.md) on UI consumption semantics
