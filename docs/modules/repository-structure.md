# SIP Repository Structure Conventions

## 1. Purpose

This document defines the repository organization for SIP, reflecting the actual project layout and boundaries between the extension, shared types, Wasm risk engine, and documentation.

## 2. Top-Level Structure

```text
sip/
├── extension/       # Chrome extension (Plasmo-based)
├── risk-engine/     # Rust → Wasm risk engine
├── docs/            # Official project documentation
├── learn/           # Exploratory materials and Chinese-language source docs
├── openspec/        # Change proposals and specifications
└── pic/             # Images and assets
```

## 3. Directory Responsibilities

### 3.1 `extension/`

Chrome extension main project (Plasmo framework), containing:

- `src/content/`: page awareness logic (`detect-context.ts`)
- `src/contents/`: Plasmo content scripts (`wallet-bridge.ts`) — injected into supported pages for wallet interaction
- `src/background/`: orchestration, message routing, intent parsing, risk/quote/simulation adapters, Wasm integration
- `src/sidepanel/`: React UI — pages, components, hooks
- `src/shared/`: runtime shared types and helpers

### 3.2 `risk-engine/`

Rust/Wasm risk engine, containing:

- `src/lib.rs`: risk scanning logic with 5 rules (Blacklist, Authority, Economic, Trust, Lifecycle)
- `pkg/`: compiled Wasm output (`sip_risk_engine_bg.wasm` + JS/TS bindings)
- Compiled artifacts are copied to `extension/src/background/wasm/` for extension consumption

### 3.3 `docs/`

Official project documentation, serving as the stable knowledge source. Consolidated from `learn/` materials.

### 3.4 `learn/`

Exploratory and Chinese-language source documents. Not the canonical source — `docs/` takes priority.

### 3.5 `openspec/`

Change proposals, design specifications, and task tracking.

## 4. `extension/src` Structure

```text
extension/src/
├── content/
│   └── detect-context.ts       # Page context detection and token extraction
├── contents/
│   └── wallet-bridge.ts        # Plasmo content script for wallet signing on supported pages
├── background/
│   ├── index.ts                # Plasmo background entry
│   ├── message-router.ts       # Core message hub, dispatches to workflow
│   ├── workflow-engine.ts      # Workflow state machine orchestration
│   ├── openai-intent-parser.ts # LLM intent parsing via OpenAI
│   ├── intent-parser.ts        # Intent parsing abstraction
│   ├── risk-adapter.ts         # Risk adapter (Wasm + policy fallback)
│   ├── wasm-risk-engine.ts     # Wasm risk engine loader
│   ├── quote-adapter.ts        # Jupiter quote integration
│   ├── preview-adapter.ts      # Execution preview builder
│   ├── simulation-adapter.ts   # Transaction simulation
│   ├── jito-adapter.ts         # Jito bundle submission
│   ├── token-context-enricher.ts # On-chain token data enrichment
│   ├── runtime-services.ts     # Runtime service factory
│   ├── mock-services.ts        # Mock services for development
│   └── wasm/                   # Compiled Wasm binary + JS/TS bindings
├── sidepanel/
│   ├── index.tsx               # Side panel entry point
│   ├── page-context.ts         # Page context selection
│   ├── wallet-bridge.ts        # Wallet status detection and signing
│   ├── wallet-provider.ts      # React wallet context provider
│   ├── wallet-state.ts         # Wallet status types
│   ├── token-confirmation.ts   # Clarification choice parsing
│   ├── styles.css
│   ├── pages/
│   │   └── SidePanelPage.tsx   # Main side panel page
│   ├── components/
│   │   ├── ActionCard.tsx
│   │   ├── DetectionBar.tsx
│   │   ├── ExecutionProgress.tsx
│   │   ├── IntentSummaryCard.tsx
│   │   ├── RiskIndicator.tsx
│   │   └── StrategyViz.tsx
│   └── hooks/
│       └── useSidePanelState.ts
├── shared/
│   ├── intent.ts               # SIPIntent, SIPAction, ClarificationPayload types
│   ├── messages.ts             # All message type definitions (17+ types)
│   ├── risk.ts                 # SecurityReport, RiskLevel, SecurityCheck types
│   ├── context.ts              # DetectedContextSnapshot, TokenHint types
│   ├── execution.ts            # ExecutionPreview type
│   ├── workflow.ts             # WorkflowPhase, WorkflowReason types
│   ├── supported-pages.ts      # SUPPORTED_PAGE_MATCHES allowlist
│   └── demo-mode.ts            # Demo mode utilities
```

## 5. Dependency Direction Constraints

- `content/` may only depend on `shared/`
- `contents/` (wallet-bridge) depends on `shared/` for `SUPPORTED_PAGE_MATCHES`
- `sidepanel/` may depend on `shared/`, but must not directly depend on `content/` or `background/`
- `background/` coordinates all adapters and Wasm integration
- `shared/` must not depend on upstream runtime implementations
- `risk-engine/` (Rust) does not depend on React, Chrome APIs, or UI code

## 6. Naming Conventions

- Type files should prefer nouns: `intent.ts`, `messages.ts`, `risk.ts`
- Orchestration files should use verbs or roles: `workflow-engine.ts`, `message-router.ts`
- Component files should match the exported component name: `ActionCard.tsx`
- Hooks should consistently start with `use`

## 7. Extension Build & Wasm Integration

- Extension is built with Plasmo (`plasmo` dev/build commands)
- Wasm is compiled from `risk-engine/` using `wasm-pack build --target web`
- Compiled Wasm output in `risk-engine/pkg/` is copied to `extension/src/background/wasm/`
- The extension loads Wasm lazily via `loadDefaultWasmRiskEngine()` with streaming instantiation

## 8. Test Structure

```
extension/tests/
├── background/          # Unit tests for background modules
├── content/             # Unit tests for content detection
├── shared/              # Contract and shared type tests
└── sidepanel/           # Component and hook tests
```

Test framework: Vitest. Run via `npm test` in the `extension/` directory.
