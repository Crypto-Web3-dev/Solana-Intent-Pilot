# Execution Preview Trueification Design

## Goal

Define how SIP should replace the remaining mock preview path with live-first quote and simulation providers while preserving deterministic fallback behavior and stable UI mapping.

## Why This Slice

SIP already has separate adapter boundaries for:

- quote
- simulation
- preview composition

The current default path is still intentionally conservative: it prefers live providers when available, but it falls back to mock behavior whenever fetch or response validation fails. That is good for resilience, but it also means the preview path is not yet fully productized:

- quote failures and simulation failures are still mostly represented as adapter exceptions
- unknown or partial upstream responses are not always mapped into stable UI-visible states
- there is no dedicated contract for how preview should behave when live data is partially available

This slice makes the preview chain explicitly live-first and closes the gap between "adapter works" and "preview is ready for demo and real use".

## Scope

In scope:

- define the live-first quote and simulation behavior
- define fallback precedence when live providers fail or return partial data
- define how quote and simulation failures should map into preview failure states
- define how `unknown` risk should remain visually distinct from success
- add deterministic tests for live-first and fallback paths

Out of scope:

- changing the runtime contract for `ExecutionPreview`
- changing the workflow state machine
- changing risk-policy thresholds
- introducing new external services beyond quote and simulation providers
- replacing the mock fallback behavior entirely

## Existing Constraints

This slice must remain aligned with current docs and code:

- `ExecutionPreview` stays the UI-facing preview contract
- `quote` and `simulation` remain separate adapter responsibilities
- mock fallback must remain available for local development
- preview failure must not masquerade as success
- `unknown` risk must remain a warning / caution state, not a success state

## Recommended Approach

### Option 1: Keep the current adapter setup unchanged

Pros:

- no additional work

Cons:

- preview remains only partially productized
- live provider behavior is not explicitly validated as a slice

### Option 2: Add a live-first preview slice with stable fallback and failure mapping

Pros:

- preserves resilience
- turns current adapter boundaries into an explicit product behavior
- easy to test

Cons:

- requires a small amount of additional contract and UI mapping work

### Option 3: Remove mock fallback once live providers are wired

Pros:

- simpler runtime path in theory

Cons:

- much higher operational risk
- worse developer experience

Recommendation: Option 2.

## Design

### 1. Live-first means preferred, not mandatory

Quote and simulation should continue to try the live provider first.

If the live provider:

- succeeds with usable data -> use it
- fails due to fetch, status, or invalid response -> fall back to the mock adapter

This preserves local development and demo resilience while making the live path the default when available.

### 2. Preview should be composed from the strongest available live signals

The preview adapter should continue to compose:

- live quote when available
- live simulation when available

If one side is live and the other falls back, the preview should still be stable and deterministic.

### 3. Partial failures should map cleanly

The slice should treat these as distinct conditions:

- quote failure
- simulation failure
- unsupported or unknown response shape

The UI should not receive a preview that looks successful if any required preview signal was actually unusable.

### 4. Unknown risk must remain visually distinct

This slice should not change risk policy thresholds, but it should make the preview UI show that `unknown` is not a successful completion state.

That means:

- a live preview can still exist even if risk is `unknown`
- the UI must not present `unknown` as safe or completed
- fallback preview data must remain obviously fallback-derived when used

### 5. Fallback behavior should be boring and deterministic

The fallback strategy should be:

- quote live path fails -> mock quote
- simulation live path fails -> mock simulation
- preview composition fails -> fail explicitly

No hidden retry loops, no silent shape coercion.

## Testing Strategy

Add tests for:

- live quote mapping from Jupiter response
- live simulation mapping from RPC preflight response
- quote live failure -> fallback
- simulation live failure -> fallback
- preview composition with mixed live/fallback providers
- UI mapping for preview failure vs unknown risk

Tests should focus on deterministic adapter behavior and preview composition, not end-to-end chain confirmation.

## Files

- Modify: `extension/src/background/quote-adapter.ts`
- Modify: `extension/src/background/simulation-adapter.ts`
- Modify: `extension/src/background/preview-adapter.ts`
- Possibly modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Possibly modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/tests/background/quote-adapter.test.ts`
- Modify: `extension/tests/background/simulation-adapter.test.ts`
- Modify: `extension/tests/background/workflow-engine.test.ts`
- Possibly modify: `extension/tests/sidepanel/action-card.test.tsx`

## Risks

- overly broad fallback mapping could hide live provider regressions
- too much UI nuance for fallback states could make the panel noisy
- partial live/fallback mixing must not produce ambiguous preview semantics
