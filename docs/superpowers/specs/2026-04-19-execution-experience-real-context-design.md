# Execution Experience And Real Context Design

## Goal

Formalize the next SIP slice that upgrades the execution path from a mock-heavy side panel flow into a more trustworthy real-page workflow.

This slice should make the panel more honest about what page it is operating on, what wallet state it sees, and what real preview signals it can gather before signing.

## Why This Slice

After the Jupiter quote integration, the most important remaining gap is not another backend adapter in isolation. The bigger user-facing weakness is that the execution flow can still feel disconnected from the actual page:

- preview simulation was still mock-only
- wallet UX did not distinguish page support from wallet availability
- submit requests were previously using hardcoded page context
- context passed into the workflow lacked meaningful page-derived hints

This slice fixes those execution and context gaps without yet taking on Wasm risk execution or OpenAI prompt redesign.

## Scope

In scope:

- Upgrade preview simulation from mock-only to `RPC preflight first, mock fallback second`
- Add a local wallet state model for the side panel execution UX
- Replace hardcoded submit page context with the current real page context
- Extend page context with lightweight real-page hints:
  - `selectedText`
  - `rawHints`
  - `detectedTokens`
- Add light platform-aware token detection for:
  - `x.com` / `twitter.com`
  - `dexscreener.com`
  - `birdeye.so`

Out of scope:

- Wasm risk engine
- OpenAI parser prompt redesign
- Real transaction construction or `simulateTransaction`
- Heavy DOM extraction or page-specific scraper trees
- Multi-tab context synchronization

## Recommended Approach

### Option 1: Keep execution UX mostly phase-based and only add RPC preflight

Pros:

- Lowest implementation effort

Cons:

- Wallet UX still feels opaque
- Page-context mismatch remains confusing

### Option 2: Introduce a small side-panel-only execution state layer on top of workflow state

Pros:

- Preserves `background` as the only workflow orchestrator
- Lets the UI distinguish wallet availability, unsupported pages, and in-progress signing
- Makes the side panel more truthful without changing runtime contracts

Cons:

- Adds one local state concept that is not part of workflow state

### Option 3: Push all execution UX state into runtime contracts immediately

Pros:

- Everything becomes explicit and shareable across contexts

Cons:

- Larger contract change
- Premature for the current slice

Recommendation: Option 2.

## Design

### 1. Simulation becomes RPC preflight with fallback

The simulation layer should move from a pure mock to a live-first adapter:

- `createRpcPreflightSimulationAdapter()` performs a lightweight Solana RPC preflight call
- `createDefaultSimulationAdapter()` uses RPC first and mock second
- `PreviewAdapter` continues to combine quote and simulation without caring which provider produced the data

This preserves current architecture while making preview output feel more grounded.

The live preflight is intentionally modest. It should prove that the panel can reach a live RPC and retrieve usable chain state, but it should not yet imply that a full transaction simulation exists.

### 2. Wallet UX gets a dedicated local state model

The panel needs a UI-facing wallet state that is distinct from workflow phase.

Recommended local states:

- `unknown`
- `checking`
- `ready`
- `provider-missing`
- `unsupported-page`
- `connecting`
- `submitted`
- `failed`

This state is local to the side panel. It should not replace `WorkflowPhase`, and it should not be treated as part of the core workflow state machine.

The reason for this separation is simple:

- `WorkflowPhase` explains where the request is
- wallet state explains whether the current page can support signing

The UI should use both.

### 3. Submit requests must use real page context

`submit()` should no longer emit hardcoded `tabId`, `url`, or `title`.

Instead, the side panel should:

- query tabs in the current window
- choose the first normal `http(s)` page
- build the `DetectedContextSnapshot` from that real page

If no normal page exists, the request should stop early with the existing `unsupported-page` behavior.

This keeps the parsing flow aligned with the actual page the user is looking at.

### 4. Real page context gets lightweight hints

The context snapshot should be upgraded from plain page metadata to low-cost execution hints:

- `selectedText` from the page selection
- `rawHints` from lightweight tokenized page text
- `detectedTokens` from platform-aware extraction rules

These hints are still intentionally lightweight. The goal is not full parsing accuracy inside this slice. The goal is to stop sending an empty context shape when the browser already knows useful things.

### 5. Platform-aware token detection stays simple

Platform-aware detection rules should remain explainable and cheap:

- `x.com` / `twitter.com`
  - detect `$SYMBOL` cashtags
- `dexscreener.com`
  - detect Solana mint from URL when present
  - collect uppercase symbol hints from page text
- `birdeye.so`
  - use the same page-source classification and generic symbol extraction

This logic should be implemented as pure helper functions where possible so it is easy to test and evolve.

## Architecture Notes

This slice deliberately keeps current architecture stable:

- `background/` remains the only orchestrator
- `sidepanel/` continues to render state and send user actions
- `shared/` contracts remain the source of truth
- page-context helpers may live in `sidepanel/` for now because this is still a side-panel initiated flow

The design does not require introducing a new cross-context message bus yet.

## Testing Strategy

Add or keep tests for these behaviors:

- simulation adapter maps live preflight success and falls back on failure
- wallet UX renders different messaging for:
  - ready
  - provider missing
  - unsupported page
  - connecting
- page context selection prefers a real normal page over extension/internal tabs
- raw hint extraction is deterministic
- platform-aware token extraction works for at least:
  - `x.com` cashtags
  - Dexscreener mint URLs

## Files

- Modify: `extension/src/background/simulation-adapter.ts`
- Modify: `extension/src/background/preview-adapter.ts`
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Modify: `extension/src/sidepanel/wallet-bridge.ts`
- Create or expand: `extension/src/sidepanel/page-context.ts`
- Create or expand tests in:
  - `extension/tests/background/simulation-adapter.test.ts`
  - `extension/tests/sidepanel/action-card.test.tsx`
  - `extension/tests/sidepanel/page-context.test.ts`

## Risks

- RPC preflight can be slow or flaky, so fallback must remain intact
- Platform-aware token detection can overfit if rules become too specific too early
- Wallet UX can drift from workflow semantics if the local state model becomes too ambitious

## Success Criteria

- The default preview path uses RPC preflight before falling back to mock simulation
- The side panel distinguishes unsupported pages from missing wallet providers
- Submit requests carry real page context instead of hardcoded placeholders
- Context snapshots include lightweight real-page hints
- Platform-aware token hints are present for `x.com` and Dexscreener
- Tests and build remain green
