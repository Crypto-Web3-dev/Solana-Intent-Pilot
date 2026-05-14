# SIP System Architecture

## 1. Overall Architecture

SIP adopts a three-layer hybrid architecture, balancing intelligence, interpretability, and execution performance:

- L1 Reasoning Layer: Cloud LLM responsible for converting natural language into structured Intent
- L2 Validation Layer: Local Rust/Wasm responsible for risk control, parsing, and pre-simulation validation
- L3 Execution Layer: Solana protocol adapters responsible for quoting, building transactions, signing, and state synchronization

The goal of this structure is to decouple "understanding" from "execution," letting cloud models handle semantics while local logic handles trusted judgment.

## 2. Layer Descriptions

### 2.1 Perception Layer

Composed of Content Script and Side Panel UI, responsible for collecting and carrying context:

- Scrape current page URL, title, selected text, detected token symbols and addresses
- Receive user natural language input
- Display context as interactive real-time hints and analysis cards

### 2.2 Reasoning Layer

Driven by cloud LLM:

- Receive user input and page context
- Output standardized JSON Intent
- Return confidence, brief reasoning explanation, and whether risk validation is needed

This layer emphasizes structured output rather than open-ended dialogue.

### 2.3 Validation Layer

Driven by local Rust/Wasm engine with policy-based fallback:

- Receive `SIPIntent` and evaluate against 5 rule-based checks (Blacklist, Authority, Economic, Trust, Lifecycle)
- Check risk indicators such as Mint Authority, Freeze Authority, token verification, liquidity, and token age
- Compute risk scores and produce structured `SecurityReport` with `source: RiskEngineSource`
- On-chain data enrichment via Jupiter API + Helius RPC before Wasm evaluation
- Fall back to `policy-fallback` when Wasm is unavailable

### 2.4 Execution Layer

Responsible for interfacing with Solana ecosystem capabilities:

- Use Jupiter V2 API for quotes and swap transactions with x-api-key authentication
- Use Jito for priority bundle submission with tips
- Detect wallet presence via content script injection into supported pages
- Trigger signing via `window.solana.signAndSendTransaction` on supported pages
- Call RPC for `simulateTransaction`
- Monitor execution results and synchronize UI state

## 3. Key Runtime Chains

### 3.1 Page Perception Chain

1. Content Script listens for DOM updates or user selection behavior
2. Detects token symbols, Base58 addresses, and contextual text within the page
3. Sends context messages to Background/Side Panel
4. Side Panel updates current focus object and suggested actions

### 3.2 Intent Execution Chain

1. User enters natural language in Side Panel
2. LLM returns JSON Intent based on page context
3. Local Wasm performs risk validation on target token or transaction object
4. Execution layer requests quote, generates preview, simulates transaction
5. User confirms and triggers wallet signature
6. Side Panel displays success, failure, or blocked result

## 4. Standard Intent Protocol

The system uses a unified `SIPIntent` data structure to ensure alignment between cloud and local execution layers. See [intent-schema.md](../api/intent-schema.md) for full type definitions.

```ts
interface SIPIntent {
  intentId: string;
  mode: "SINGLE" | "ATOMIC_BUNDLE" | "PARALLEL";
  actions: SIPAction[];
  metadata: SIPIntentMetadata;
}
```

Runtime validation is applied to prevent format drift that would harm downstream execution chains.

## 5. Communication Relationships

- `content/detect-context` → `background/message-router`: Page context, address detection results, page events
- `background/message-router` → `sidepanel`: `workflow.state.changed` broadcasts, detection results, execution progress
- `background` → `openai-intent-parser`: User input and structured reasoning via OpenAI API
- `background/risk-adapter` → `wasm-risk-engine`: Risk scan requests, receives `SecurityReport`
- `background/quote-adapter` → Jupiter API: Quote and swap transaction requests
- `background/simulation-adapter` → Solana RPC: `simulateTransaction` calls
- `background/jito-adapter` → Jito: Bundle submission
- `sidepanel/wallet-bridge` → `contents/wallet-bridge`: Wallet detection and transaction signing via page injection

## 6. Technology Choices

| Domain | Choice | Purpose |
| --- | --- | --- |
| Extension Framework | Plasmo + React + TypeScript | Build Chrome extension and Side Panel UI |
| Reasoning Model | OpenAI / Claude / Compatible Models | Structured intent parsing |
| Local Computation | Rust + wasm-bindgen | Risk scanning and high-performance data parsing |
| Execution Adapter | Jupiter API + Jito | Quote, swap, and priority bundle submission |
| On-chain Data | Helius / QuickNode / Compatible RPC | Balance, assets, simulation, and subscriptions |
| Wallet | Phantom (`window.solana`) | Transaction signing via content script injection |

## 7. Architecture Principles

- Cloud only handles semantic reasoning; it does not provide final safety endorsement
- Local logic prioritizes sensitive, verifiable, and high-frequency computation tasks
- Transaction execution must pass structured validation and user confirmation
- UI display should always be able to explain the current action, risk, and result
- Design should prioritize demo-friendliness and future module extensibility
