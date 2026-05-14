# SIP Module Breakdown

## 1. Module Overview

SIP is organized into six core modules, each focused on a single responsibility while collaborating through typed messages.

## 2. Module List

### 2.1 Web Context Capture

Source: `extension/src/content/detect-context.ts`

Responsibilities:

- Listen for DOM changes and user interactions
- Identify token symbols, Mint addresses, and text clues on the page
- Extract context such as title, URL, and selected text
- Enforce input bounds (MAX_BODY_TEXT_CHARS, MAX_SELECTED_TEXT_CHARS, etc.)

Key implementation:

- `MutationObserver`
- Base58 address regex filtering
- Platform-specific detection: Twitter, Dexscreener, generic (Birdeye detection from context source tag)
- Pump.fun URL regex for direct mint extraction

Input/Output:

- Input: current page DOM, user selection behavior
- Output: `context.detected` message with `DetectedContextSnapshot` payload

### 2.2 Intent Intelligence

Source: `extension/src/background/openai-intent-parser.ts`, `intent-parser.ts`

Responsibilities:

- Assemble system prompt with page context and token hints
- Call LLM to output structured `SIPIntent`
- Handle model confidence, clarification needs, and anomalous output
- Enrich intent with on-chain token data via `token-context-enricher.ts`

Key implementation:

- Few-shot prompt with context injection
- JSON Schema / Zod validation
- Fallback to policy-based parsing on failure
- `ClarificationPayload` for ambiguous or missing mint resolution

Input/Output:

- Input: user command, page context (`DetectedContextSnapshot`), enriched token data
- Output: standard `SIPIntent` object with actions, metadata, and optional clarification

### 2.3 Local Wasm Risk Engine

Source: `risk-engine/src/lib.rs`, `extension/src/background/wasm-risk-engine.ts`, `risk-adapter.ts`

Responsibilities:

- Risk scanning using 5 rule-based checks
- Mint Authority / Freeze Authority checks (AuthorityRule)
- Economic, trust, lifecycle, and blacklist checks
- Provide scores, labels, and explanations for UI

Key implementation:

- Rust + `wasm-bindgen`, compiled via `wasm-pack build --target web`
- Exports `scan_risk(intent_json: &str) -> String`
- 5 rules: BlacklistRule, AuthorityRule, EconomicRule, TrustRule, LifecycleRule
- Unified `SecurityReport` return structure with `source: RiskEngineSource`
- Policy fallback (`policy-fallback`) when Wasm is unavailable
- Live on-chain data enrichment via Jupiter API + Helius RPC

Input/Output:

- Input: `SIPIntent` (JSON-serialized)
- Output: `SecurityReport` with score, level, blocking, checks[], summary, source

### 2.4 On-chain Execution Adapter

Source: `extension/src/background/quote-adapter.ts`, `preview-adapter.ts`, `simulation-adapter.ts`, `jito-adapter.ts`

Responsibilities:

- Connect Jupiter for quotes and swap transactions
- Build execution previews with slippage and fee details
- Run transaction simulations via RPC
- Submit transactions via Jito bundles for priority execution

Key implementation:

- Jupiter V2 `/quote` and `/swap` API with x-api-key authentication
- `simulateTransaction` via Solana RPC
- Jito bundle submission with tip
- `ExecutionPreview` with input/output amounts, fees, and unsigned transaction

Input/Output:

- Input: standard `SIPIntent`, risk check result
- Output: `ExecutionPreview`, transaction signature, submission status

### 2.5 Wallet Bridge

Source: `extension/src/contents/wallet-bridge.ts`, `extension/src/sidepanel/wallet-bridge.ts`

Responsibilities:

- Detect wallet presence (Phantom) on supported pages
- Find signable tabs from the page allowlist
- Submit transactions for signing via `window.solana.signAndSendTransaction`
- Handle wallet status states and 60s submission timeout

Key implementation:

- Plasmo content script with `config.matches = SUPPORTED_PAGE_MATCHES`
- Script injection into supported pages for wallet detection and signing
- `findSignableTab()` filters tabs by supported URL
- `WalletStatus` type: `unknown | checking | ready | provider-missing | unsupported-page | connecting | submitted | failed`

Input/Output:

- Input: `SIPIntent`, `ExecutionPreview`, preferred tab ID
- Output: transaction signature or failure

### 2.6 Side Panel Experience

Source: `extension/src/sidepanel/`

Responsibilities:

- Host conversation, risk cards, and action cards
- Display page-awareness results and execution feedback
- Provide a low-learning-curve interaction entry point
- Manage wallet connection and signing UI

Key implementation:

- React component tree with SidePanelPage as root
- Components: ActionCard, DetectionBar, ExecutionProgress, IntentSummaryCard, RiskIndicator, StrategyViz
- `useSidePanelState` hook for workflow state management
- Framer Motion state animation
- Tailwind theme system

Input/Output:

- Input: context detection results, Intent, risk report, execution status
- Output: user interaction events, confirmation actions, visual feedback

## 3. Recommended Directory Structure

```text
extension/src/
├── content/
│   └── detect-context.ts
├── contents/
│   └── wallet-bridge.ts
├── background/
│   ├── index.ts
│   ├── message-router.ts
│   ├── workflow-engine.ts
│   ├── openai-intent-parser.ts
│   ├── intent-parser.ts
│   ├── risk-adapter.ts
│   ├── wasm-risk-engine.ts
│   ├── quote-adapter.ts
│   ├── preview-adapter.ts
│   ├── simulation-adapter.ts
│   ├── jito-adapter.ts
│   ├── token-context-enricher.ts
│   ├── runtime-services.ts
│   ├── mock-services.ts
│   └── wasm/
├── sidepanel/
│   ├── index.tsx
│   ├── page-context.ts
│   ├── wallet-bridge.ts
│   ├── wallet-provider.ts
│   ├── wallet-state.ts
│   ├── token-confirmation.ts
│   ├── pages/
│   ├── components/
│   └── hooks/
├── shared/
│   ├── intent.ts
│   ├── messages.ts
│   ├── risk.ts
│   ├── context.ts
│   ├── execution.ts
│   ├── workflow.ts
│   ├── supported-pages.ts
│   └── demo-mode.ts
```

## 4. Module Communication

Modules communicate through typed message interfaces defined in `shared/messages.ts` (17+ message types):

- Content → Background: `context.detected`
- Background → Side Panel: `intent.parse.succeeded`, `risk.scan.completed`, `execution.preview.ready`, `workflow.state.changed`
- Side Panel → Background: `execution.confirmed`, `execution.cancelled`, `execution.retry.requested`
- Wasm → Risk Adapter: `SecurityReport`
- Wallet Bridge → Background: `wallet.submission.completed`, `wallet.submission.failed`

## 5. Data Flow

```
Web Page → Content Script (detect) → Background (route) → LLM (parse) → SIPIntent
                                                                   ↓
                                                     Wasm (risk check) → SecurityReport
                                                                   ↓
                                               Jupiter (quote) → ExecutionPreview
                                                                   ↓
                                              Wallet (sign) → On-chain Submit (Jito)
```
