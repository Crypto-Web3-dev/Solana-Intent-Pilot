# SIP Frontend Component Architecture

## 1. Goals

The frontend component architecture needs to support three things:

- Complex state display in the Side Panel
- Continuous feedback from AI, risk scanning, and execution flows
- Quick visual style replacement later without breaking business boundaries

## 2. Page Structure

The Side Panel entry page is organized as:

- `SidePanelPage`: Top-level container, responsible for state subscription and layout orchestration
- `DetectionBar`: Page-aware alert bar
- `ActionCard`: Primary execution card with risk display and confirmation actions
- `IntentSummaryCard`: Parsed intent summary display
- `RiskIndicator`: Risk level visual indicator (shield icon + color)
- `ExecutionProgress`: Execution status and transaction progress
- `StrategyViz`: Strategy visualization

## 3. Component Inventory

### 3.1 Page Layer

| Component | File | Responsibility |
|-----------|------|---------------|
| SidePanelPage | `pages/SidePanelPage.tsx` | Root page, state subscription, layout |

### 3.2 Domain Components

| Component | File | Responsibility |
|-----------|------|---------------|
| ActionCard | `components/ActionCard.tsx` | Primary execution card, risk display, confirm/cancel actions |
| DetectionBar | `components/DetectionBar.tsx` | Page-aware alert bar showing detected tokens |
| ExecutionProgress | `components/ExecutionProgress.tsx` | Transaction execution status and progress |
| IntentSummaryCard | `components/IntentSummaryCard.tsx` | Parsed intent summary (input/output amounts) |
| RiskIndicator | `components/RiskIndicator.tsx` | Risk level shield with color (green/yellow/red) |
| StrategyViz | `components/StrategyViz.tsx` | Strategy visualization |

### 3.3 Hooks

| Hook | File | Responsibility |
|------|------|---------------|
| useSidePanelState | `hooks/useSidePanelState.ts` | Central workflow state management |

### 3.4 Side Panel Modules

| Module | File | Responsibility |
|--------|------|---------------|
| page-context | `page-context.ts` | Page context selection (tabs, content script queries) |
| wallet-bridge | `wallet-bridge.ts` | Wallet detection, signable tab selection, transaction submission |
| wallet-provider | `wallet-provider.ts` | React wallet context provider |
| wallet-state | `wallet-state.ts` | `WalletStatus` type definition |
| token-confirmation | `token-confirmation.ts` | Clarification choice parsing and formatting |

## 4. Actual Directory Structure

```text
extension/src/sidepanel/
├── index.tsx                   # Entry point
├── pages/
│   └── SidePanelPage.tsx       # Root page component
├── components/
│   ├── ActionCard.tsx
│   ├── DetectionBar.tsx
│   ├── ExecutionProgress.tsx
│   ├── IntentSummaryCard.tsx
│   ├── RiskIndicator.tsx
│   └── StrategyViz.tsx
├── hooks/
│   └── useSidePanelState.ts
├── page-context.ts
├── wallet-bridge.ts
├── wallet-provider.ts
├── wallet-state.ts
├── token-confirmation.ts
└── styles.css
```

## 5. State Management

The primary state management is via `useSidePanelState` hook:

- Subscribes to `workflow.state.changed` messages from the background
- Manages: current phase, intent, risk report, execution preview, wallet status
- Provides: confirm, cancel, retry actions
- Does NOT derive workflow state independently — only renders and forwards user actions

## 6. Background Module Inventory

The background layer contains the orchestration and adapter modules:

| Module | File | Responsibility |
|--------|------|---------------|
| Message Router | `message-router.ts` | Central message dispatch hub |
| Workflow Engine | `workflow-engine.ts` | State machine orchestration |
| Intent Parser | `openai-intent-parser.ts` | LLM intent parsing via OpenAI |
| Intent Parser Abstraction | `intent-parser.ts` | Parser interface |
| Risk Adapter | `risk-adapter.ts` | Wasm + policy fallback risk evaluation |
| Wasm Risk Engine | `wasm-risk-engine.ts` | Wasm loader and bridge |
| Quote Adapter | `quote-adapter.ts` | Jupiter V2 quote integration |
| Preview Adapter | `preview-adapter.ts` | Execution preview builder |
| Simulation Adapter | `simulation-adapter.ts` | Transaction simulation |
| Jito Adapter | `jito-adapter.ts` | Jito bundle submission |
| Token Context Enricher | `token-context-enricher.ts` | On-chain token data enrichment |
| Runtime Services | `runtime-services.ts` | Service factory (mock + production) |
| Mock Services | `mock-services.ts` | Mock implementations for development |
| Wasm Binary | `wasm/` | Compiled Wasm + JS/TS bindings |

## 7. Data Flow

```
Page DOM
  → content/detect-context.ts (capture context)
  → background/message-router.ts (dispatch)
  → background/openai-intent-parser.ts (parse intent)
  → SIPIntent
  → background/token-context-enricher.ts (enrich on-chain data)
  → background/risk-adapter.ts → wasm/scan_risk (risk check)
  → SecurityReport
  → background/quote-adapter.ts (Jupiter quote)
  → ExecutionPreview
  → sidepanel/ (render result, await user action)
  → sidepanel/wallet-bridge.ts → contents/wallet-bridge.ts (sign transaction)
  → background/jito-adapter.ts (submit bundle)
  → Transaction result
```
