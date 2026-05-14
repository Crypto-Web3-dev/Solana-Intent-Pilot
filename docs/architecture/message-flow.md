# SIP Message Flow Design

## 1. Goal

The SIP message flow needs to solve three things:

- Reliably synchronize state across multiple Chrome extension runtime contexts
- Enable page perception, AI reasoning, risk validation, and execution flow to be chained together
- Avoid making the UI directly depend on complex async logic or external interface details

## 2. Runtime Contexts

The main message participants in SIP are:

- `content script`: responsible for page perception and context extraction
- `background worker`: responsible for message relay, long-lived state, and external request orchestration
- `side panel`: responsible for displaying UI, receiving user input, and driving interaction
- `wasm engine`: responsible for local risk scanning
- `llm service`: responsible for structured intent reasoning
- `execution adapter`: responsible for quoting, simulation, signing, and sending transactions

## 3. Core Message Types

### 3.1 Page Perception Message

```ts
type DetectedContextMessage = {
  type: "context.detected";
  payload: {
    tabId: number;
    url: string;
    title: string;
    selectedText?: string;
    detectedTokens: Array<{
      symbol?: string;
      mint?: string;
      source: "twitter" | "birdeye" | "dexscreener" | "generic";
      confidence: number;
    }>;
    rawHints: string[];
    detectedAt: string;
  };
};
```

Usage:

- Sent from Content Script to Background
- Then broadcast by Background to Side Panel

### 3.2 User Intent Request Message

```ts
type IntentParseRequestedMessage = {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
  };
};
```

Usage:

- Initiated from Side Panel
- Processed uniformly by Background, which internally calls the AI service

### 3.3 Risk Scan Request Message

```ts
type RiskScanRequestedMessage = {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    accountDataBase64?: string;
    sourceIntent: SIPIntent["payload"];
  };
};
```

### 3.4 Execution Preview Message

```ts
type ExecutionPreviewReadyMessage = {
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
};
```

### 3.5 State Update Message

```ts
type WorkflowStateMessage = {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase:
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
    reason?: WorkflowReason | string;
  };
};
```

## 4. Main Flow Orchestration

### 4.1 Perception Flow

1. Content Script scans the page and generates `context.detected`
2. Background stores the latest context snapshot
3. Side Panel subscribes and renders the Detection Bar and context cards

### 4.2 Intent Execution Flow

1. Side Panel sends `intent.parse.requested`
2. Background calls the LLM service
3. After LLM returns the Intent, emit `workflow.state.changed(parsing -> risk-checking)`
4. Background emits `risk.scan.requested`
5. After risk scan completes, if passed, enter the quote and simulation phase
6. Generate `execution.preview.ready`
7. After user confirmation, enter signature and submission state

### 4.3 Error and Block Flow

- LLM output invalid: enter `failed`
- Risk too high: enter `blocked`
- Quote failed or RPC congested: enter `failed`, with fallback guidance
- User cancels signature: revert to `idle` or preserve most recent preview

## 5. Design Principles

- All async flows must carry a `requestId`
- Side Panel only consumes state and results; it does not directly hold underlying execution logic
- Background is the primary orchestration layer, reducing multiple page contexts from each independently requesting external services
- Message payloads should use serializable pure data as much as possible, avoiding complex object references

## 6. Shared Type Organization

Types are distributed across `extension/src/shared/` files:

- `messages.ts`: Message type interfaces and `SIPRuntimeMessage` union type
- `intent.ts`: `SIPIntent`, `SIPAction`, `SIPIntentMetadata`, `ClarificationPayload`
- `risk.ts`: `SecurityReport`, `RiskLevel`, `RiskEngineSource`, `SecurityCheck`
- `context.ts`: `DetectedContextSnapshot`, `TokenHint`
- `execution.ts`: `ExecutionPreview`
- `workflow.ts`: `WorkflowPhase`, `WorkflowReason` enums
- `supported-pages.ts`: `SUPPORTED_PAGE_MATCHES`, `isSupportedPageUrl()`
- `demo-mode.ts`: Demo mode utilities

This allows Content Script, Background, and Side Panel to share the same contracts.
