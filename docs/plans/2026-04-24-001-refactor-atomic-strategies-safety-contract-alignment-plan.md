---
title: Atomic Strategies Safety And Contract Alignment Plan
type: refactor
status: active
date: 2026-04-24
origin: docs/superpowers/specs/2026-04-24-atomic-strategies-safety-contract-alignment-design.md
---

# Atomic Strategies Safety And Contract Alignment Plan

## Overview

Repair the `atomic-strategies` worktree so its runtime behavior, shared contracts, and documentation all describe the same system. The plan prioritizes safety fixes first, then upgrades the docs to the `actions / bundle` model, then aligns implementation details and mock handling to that contract.

## Problem Frame

The current branch mixes documented MVP behavior with a more advanced `actions[] + mode` implementation, while also retaining insecure credential handling and success-like mock fallbacks. This creates a branch that is difficult to trust, difficult to reason about, and difficult to review against `docs/` as the source of truth. The goal is not to add more features, but to make the current feature surface safe, explicit, and internally consistent. (see origin: docs/superpowers/specs/2026-04-24-atomic-strategies-safety-contract-alignment-design.md)

## Requirements Trace

- R1. Remove hardcoded provider credentials from repo code.
- R2. Prevent live provider failure from being represented as successful execution.
- R3. Upgrade the authoritative docs to the `actions / bundle` runtime model.
- R4. Align `shared/` runtime contracts with the upgraded docs.
- R5. Tighten workflow transitions so only valid preview paths can reach `awaiting-signature`.
- R6. Restrict mock behavior to test-only, dev-only, or explicit degraded runtime paths.

## Scope Boundaries

- No new intent types or provider integrations are introduced.
- No backend key-management system is added in this plan.
- No architectural ownership changes are made beyond clarifying existing boundaries.

## Context & Research

### Relevant Code and Patterns

- `extension/src/background/workflow-engine.ts` owns request-level phase transitions and should remain the sole transition authority.
- `extension/src/background/message-router.ts` coordinates parse, risk, quote, simulation, and preview side effects for one request.
- `extension/src/shared/` is already the intended home for runtime contracts, but several files are out of sync with docs and runtime usage.
- `extension/src/background/risk-adapter.ts` already models a documented fallback source with `policy-fallback`, which is a good pattern for explicit degradation.

### Institutional Learnings

- The repo’s engineering conventions require `background/` to stay the only workflow orchestrator, `sidepanel/` to render state only, and `shared/` to remain the single source of runtime contracts.
- The testing guidance explicitly prioritizes workflow transitions, contract integrity, risk-policy decisions, and UI distinctions between blocked, failed, and clarification states.

### External References

- None required for this repair plan; the work is driven by local docs, current implementation, and repository conventions.

## Key Technical Decisions

- Upgrade docs to match the current `actions / bundle` direction instead of forcing implementation back to the older single-payload contract.
- Treat bundled extension configuration as non-secret and remove hardcoded keys rather than pretending they are protected.
- Keep fallback behavior only when it is explicit, typed, and non-success-like.
- Narrow the first strong typing pass to the currently active swap execution path instead of prematurely designing every possible future action payload.

## Open Questions

### Resolved During Planning

- Should the contract repair revert the code to the older doc model? No. The authoritative docs should be upgraded to the current `actions / bundle` model.
- Should mock behavior be removed entirely? No. It should be retained only where it is clearly test-only, dev-only, or explicit runtime degradation.

### Deferred to Implementation

- Whether degraded preview needs a dedicated field on `ExecutionPreview` or a parallel message/state flag can be finalized during implementation once the shared contract edits are underway.
- The exact split between request-level and action-level risk metadata can be finalized while updating `shared/intent.ts` and the affected tests.

## Implementation Units

- [ ] **Unit 1: Remove Unsafe Provider Configuration And Success-Like Fallbacks**

**Goal:** Eliminate the highest-risk credential and runtime-deception behavior before broader contract refactoring.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`
- Modify: `extension/src/background/quote-adapter.ts`
- Modify: `extension/src/background/simulation-adapter.ts`
- Modify: `extension/src/background/index.ts`
- Modify: `extension/src/background/runtime-services.ts`
- Test: `extension/tests/background/simulation-adapter.test.ts`
- Test: `extension/tests/background/workflow-engine.test.ts`

**Approach:**
- Remove hardcoded provider and RPC key literals.
- Make missing runtime configuration produce explicit unavailable or degraded behavior instead of silently enabling mock-happy-path execution.
- Change simulation fallback semantics so live failure cannot return a `"Mock simulation passed"` result that looks like verified success.

**Execution note:** Start with failing behavior tests for provider failure and fallback behavior before changing runtime code.

**Patterns to follow:**
- `extension/src/background/risk-adapter.ts` for explicit fallback source modeling.

**Test scenarios:**
- Happy path: configured live simulation succeeds and preserves success semantics.
- Error path: live simulation fetch throws and runtime does not emit a success-like simulation summary.
- Error path: missing provider configuration does not auto-select a happy-path mock runtime in non-test code.
- Integration: message router handling of preview generation stops before signable state when simulation cannot produce a valid result.

**Verification:**
- Source no longer contains hardcoded provider or RPC key literals, and provider failure cannot yield a success-looking preview path.

- [ ] **Unit 2: Upgrade Documentation To Actions-Bundle Contracts**

**Goal:** Make the docs the authoritative description of the current runtime model.

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Modify: `docs/api/runtime-contracts.md`
- Modify: `docs/api/message-types.md`
- Modify: `docs/architecture/workflow-state-machine.md`
- Modify: `docs/api/ui-state-mapping.md`
- Modify: `docs/architecture/message-flow.md`

**Approach:**
- Replace the older single top-level intent payload description with the current `intentId + actions[] + mode + metadata` model.
- Document bundle semantics, preview invariants, and the conditions for entering `awaiting-signature`.
- Make the docs explicitly describe degraded fallback behavior as non-success-like.

**Patterns to follow:**
- Existing doc tone and structure in `docs/api/` and `docs/architecture/`.

**Test scenarios:**
- Test expectation: none -- documentation-only unit, but the resulting docs must be internally consistent and traceable to the active runtime model.

**Verification:**
- The updated doc set consistently describes one runtime model with no remaining reliance on a nonexistent top-level `SIPIntent.payload`.

- [ ] **Unit 3: Align Shared Contracts With The Upgraded Docs**

**Goal:** Restore `shared/` as the typed, serializable implementation of the documented runtime contracts.

**Requirements:** R4

**Dependencies:** Unit 2

**Files:**
- Modify: `extension/src/shared/intent.ts`
- Modify: `extension/src/shared/messages.ts`
- Modify: `extension/src/shared/execution.ts`
- Modify: `extension/src/shared/risk.ts`
- Test: `extension/tests/shared/contracts.test.ts`

**Approach:**
- Replace `payload: any` with a typed action payload model, starting with the active swap path.
- Update message types so `RiskScanRequestedMessage` and related runtime messages match actual runtime objects.
- Align `ExecutionPreview` with the fields the preview path is allowed to emit, including any bundle-specific fields adopted by the updated docs.

**Patterns to follow:**
- Serializable shapes already used across `extension/src/shared/`.

**Test scenarios:**
- Happy path: a single swap intent satisfies the upgraded `SIPIntent` shape.
- Happy path: a bundle intent serializes with ordered actions and request-level metadata.
- Edge case: clarification metadata remains request-level and does not masquerade as a workflow phase.
- Error path: malformed message payloads fail type expectations and can no longer be pushed via `as any`.

**Verification:**
- `shared/` types compile without `any` escape hatches in active runtime boundaries, and shared contract tests reflect the updated docs.

- [ ] **Unit 4: Tighten Workflow And Router Semantics**

**Goal:** Make runtime transitions match the documented phase semantics and prevent premature signable states.

**Requirements:** R2, R5

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `extension/src/background/workflow-engine.ts`
- Modify: `extension/src/background/message-router.ts`
- Modify: `extension/src/background/preview-adapter.ts`
- Modify: `extension/src/background/mock-services.ts`
- Test: `extension/tests/background/workflow-engine.test.ts`
- Test: `extension/tests/background/preview-adapter.test.ts`

**Approach:**
- Separate quoting, simulation, and preview readiness more clearly in the workflow engine.
- Ensure bundle readiness means "coherent preview path complete", not just "all actions produced transactions".
- Respect simulation results explicitly; a failed or degraded simulation cannot be treated as a verified preview.

**Execution note:** Add or update failing workflow tests before changing transition logic.

**Patterns to follow:**
- Current request-level orchestration ownership in `background/`.

**Test scenarios:**
- Happy path: valid single-action request progresses through parsing -> risk-checking/quoting -> simulating -> awaiting-signature.
- Happy path: valid bundle request only reaches `awaiting-signature` after preview invariants are satisfied.
- Error path: simulation failure leaves the workflow in `failed` or documented degraded handling, never `awaiting-signature`.
- Error path: quote failure preserves valid request context and fails with the correct reason.
- Integration: preview adapter output and workflow state transitions remain consistent for both single and bundle flows.

**Verification:**
- Workflow tests prove that premature signable states are no longer reachable.

- [ ] **Unit 5: Restrict Mock Behavior And Clean Up Sidepanel Consumption**

**Goal:** Ensure the UI and runtime present mock and degraded behavior honestly.

**Requirements:** R6, R5

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Test: `extension/tests/sidepanel/action-card.test.tsx`
- Test: `extension/tests/sidepanel/risk-indicator.test.tsx`
- Test: `extension/tests/sidepanel/useSidePanelState.test.ts`

**Approach:**
- Remove mock-facing submission artifacts from the normal user flow.
- Render degraded and unknown states distinctly from verified success paths.
- Keep sidepanel decisions driven by workflow state and contract data rather than ad hoc interpretation.

**Patterns to follow:**
- Existing sidepanel state consumption through `useSidePanelState`.

**Test scenarios:**
- Happy path: verified preview renders signable controls only in `awaiting-signature`.
- Error path: failed submission or preview errors render as failure, not blocked or success.
- Edge case: degraded or unknown preview/risk states remain visually distinct from verified success.
- Integration: sidepanel state updates correctly from `workflow.state.changed` plus contract messages without surfacing mock submission copy.

**Verification:**
- Normal sidepanel flows no longer display mock submission artifacts, and UI tests cover degraded vs failed vs blocked distinctions.

## System-Wide Impact

- **Interaction graph:** Changes cross `docs/`, `shared/`, `background/`, and `sidepanel/`, but orchestration remains in `background/`.
- **Error propagation:** Provider and simulation failures become explicit state outcomes instead of hidden fallback success.
- **State lifecycle risks:** Tightening transitions may expose assumptions in tests or UI timing that currently depend on optimistic fallback behavior.
- **API surface parity:** Shared contract changes affect parser, router, preview, and UI consumers together.
- **Integration coverage:** Request-level workflow and preview tests are required because unit tests alone will not prove multi-step state correctness.
- **Unchanged invariants:** `background/` remains the only workflow orchestrator; `sidepanel/` remains a renderer/consumer; `unknown` remains a risk label, not a workflow phase.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Contract edits ripple through many tests at once | Land docs and shared contract updates before router/UI alignment so failures are easier to interpret |
| Removing mock-success behavior makes local development feel harsher | Preserve explicit dev/test helpers and document degraded behavior clearly |
| Bundle preview semantics remain underspecified during implementation | Define preview invariants in docs first and use them as the acceptance gate in workflow tests |

## Documentation / Operational Notes

- Update docs before or alongside shared type changes in the same workstream to preserve the repo contract that `docs/` is the source of truth.
- Treat any remaining extension-side provider configuration as public and bounded by provider-side quotas, not as protected secrets.

## Sources & References

- **Origin document:** `docs/superpowers/specs/2026-04-24-atomic-strategies-safety-contract-alignment-design.md`
- Related code: `extension/src/background/workflow-engine.ts`
- Related code: `extension/src/background/message-router.ts`
- Related code: `extension/src/shared/intent.ts`
- Related docs: `docs/api/runtime-contracts.md`
