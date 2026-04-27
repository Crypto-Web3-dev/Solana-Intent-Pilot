# Atomic Strategies Safety And Contract Alignment Design

## Summary

This change closes the gap between the `atomic-strategies` implementation and the current SIP documentation set. It has three linked goals:

1. remove unsafe runtime behavior that can leak provider credentials or disguise provider failures as successful execution;
2. upgrade the authoritative docs to the current `actions / bundle` runtime model instead of forcing the code back to the older single-payload model;
3. align `shared/`, `background/`, and `sidepanel/` code with the upgraded contracts so the extension has one consistent runtime story.

The work is intentionally a repair slice, not a product expansion slice. It does not add new execution features, new intent types, or new providers. It makes the current shape safe, explicit, and document-backed.

## Problem

The current branch has drifted in three places at once.

First, the runtime has security debt. Provider keys are hardcoded in source, browser-facing code paths can access configuration that should be treated as public if bundled, and multiple fallback paths return mock success-like results after live provider failure. That violates the trust-boundary rule that external failure must not be repackaged as success.

Second, the documentation still treats `SIPIntent` as a single top-level payload object, while the code now uses `intentId + actions[] + mode + metadata`. This breaks the stated rule that `shared/` is the single source of truth for runtime contracts. It also forces unsafe escape hatches such as `any` payloads and `as any` message coercion.

Third, workflow semantics have become blurry. The engine, router, preview adapter, and UI no longer agree on the exact meaning of `quoting`, `simulating`, and `awaiting-signature`, especially for multi-action or bundle flows. That increases the risk of showing users a signable state before the system has a trustworthy preview.

## Goals

- Remove hardcoded provider credentials from repo code.
- Make provider fallback behavior explicit and non-success-like.
- Promote the `actions / bundle` model into the authoritative docs.
- Replace weak runtime types and message escapes with serializable, typed contracts.
- Tighten workflow transitions so the UI only enters `awaiting-signature` after a valid preview path completes.
- Keep mock paths available where useful, but classify them as `test-only`, `dev-only`, or explicit runtime degradation.

## Non-Goals

- Adding new supported action types beyond the current code paths.
- Building a new override flow for blocked or high-risk actions.
- Introducing backend secret storage or a new server-side proxy in this slice.
- Reworking the overall extension architecture away from `background` as the workflow orchestrator.

## Recommended Approach

### Option 1: Safety And Contract First, Then Implementation Alignment

Update the docs and shared contracts first, while immediately fixing the highest-risk runtime behavior. Then align workflow, router, adapters, and UI to that contract set.

This is the recommended option because the current failure mode is drift between docs, types, and runtime. A contract-first repair gives the rest of the code a stable target.

### Option 2: Implementation First, Then Document The Result

Repair workflow, adapters, and UI immediately, then rewrite docs after behavior stabilizes.

This is faster in the very short term, but it repeats the same pattern that caused the current mismatch and makes review harder.

### Option 3: Split Security, Contracts, And Mock Cleanup Into Separate Tracks

Treat credential handling, contract alignment, and workflow/mock cleanup as separate changes.

This reduces per-change scope but increases coordination cost because these problems overlap heavily. For example, preview fallback semantics affect both the security model and the contract model.

## Decision

Use Option 1.

Apply the fix in three layers:

1. immediate safety repair for credentials and unsafe fallback semantics;
2. authoritative documentation upgrade to `actions / bundle`;
3. code alignment to the new contract set and explicit mock/degradation policy.

## Design

### 1. Runtime Model

The branch will formally adopt an intent model shaped like:

- `SIPIntent`
  - `intentId`
  - `actions: SIPAction[]`
  - `mode: "SINGLE" | "ATOMIC_BUNDLE"`
  - `metadata`

- `SIPAction`
  - `id`
  - `type`
  - `payload`
  - `status`

The docs will no longer describe a single top-level `payload` as the only execution model. Instead:

- `mode = "SINGLE"` means one executable action;
- `mode = "ATOMIC_BUNDLE"` means an ordered set of actions treated as one request-level workflow;
- `metadata.needsClarification` remains request-level metadata, not a workflow phase;
- `background/` stays the only owner of workflow transitions.

This keeps the current code direction while restoring a stable, documented contract boundary.

### 2. Contract Updates

The following doc set must be updated together:

- `docs/api/runtime-contracts.md`
- `docs/api/message-types.md`
- `docs/architecture/workflow-state-machine.md`
- `docs/api/ui-state-mapping.md`
- `docs/architecture/message-flow.md` if current descriptions still assume a single-payload intent

Key contract changes:

- `SIPIntent` becomes the `actions / bundle` shape.
- `SIPAction.payload` becomes typed by action kind, starting with the swap path actually used in this branch.
- `RiskScanRequestedMessage` stops referencing a nonexistent `SIPIntent["payload"]`.
- `ExecutionPreview` explicitly distinguishes the single-action preview fields from bundle-related preview fields that the UI may consume.
- Message docs and shared types must use the same field names and optionality.

### 3. Security And Fallback Semantics

This slice treats bundled extension configuration as non-secret. Therefore:

- no provider key may be hardcoded in source;
- no runtime should silently downgrade to a mock success state after a live failure;
- any fallback that remains must be visibly marked as degraded and must not imply safe execution.

Fallback policy:

- Risk fallback to `policy-fallback` remains allowed because it is already a documented source type.
- Quote fallback may remain only if the resulting preview is explicitly marked degraded and not equivalent to a verified live preview.
- Simulation fallback may not return a success-like `"passed"` result after live simulation failure.
- Missing provider configuration in non-test runtime must produce an explicit unavailable/degraded state, not silently run the happy path through mock services.

### 4. Workflow Semantics

The workflow docs and code will align around these rules:

- `parsing` ends only after a valid `SIPIntent` is produced or an explicit invalid/clarification outcome is reached.
- `risk-checking` is request-level, but it may evaluate one or more actions under the same request.
- `quoting` means the system is gathering order/route data required to construct the previewable execution path.
- `simulating` means the system is validating the execution path and may not be treated as success until its result is known.
- `awaiting-signature` is only reachable after the preview object is valid for the current request and the execution path is not blocked or failed.

For bundle mode, "all actions have quote artifacts" is not enough to enter `awaiting-signature`. The request must also have a coherent bundle preview and a successful or explicitly policy-allowed degraded simulation result.

### 5. Mock Classification

Mock behavior remains useful, but only if its role is explicit.

The branch will classify mock code into:

- `test-only`: deterministic fixtures and mocks used only by tests;
- `dev-only`: optional development helpers that are not part of production runtime decisions;
- `runtime fallback`: narrowly scoped degradations that remain visible in runtime state and UI.

The sidepanel must stop exposing production-facing mock controls or mock success artifacts. If development helpers remain, they should be gated by environment and not appear in the normal user flow.

## Component Impact

### `shared/`

`shared/` becomes the strict implementation of the upgraded docs. This includes:

- replacing `payload: any` with typed payload interfaces;
- aligning message types with actual runtime objects;
- aligning `ExecutionPreview` with what the preview adapter is allowed to emit.

### `background/`

`background/` remains the only orchestrator. It must:

- enforce the updated workflow transitions;
- stop using `as any` to push malformed payloads across boundaries;
- make fallback/degraded behavior explicit in emitted messages and state changes;
- never promote a failed live provider call into a success-looking state.

### `sidepanel/`

`sidepanel/` remains a consumer. It must:

- distinguish blocked, failed, clarification, unknown, and degraded states;
- stop surfacing leftover mock submission language in normal flows;
- only show signable UI when the workflow has explicitly reached `awaiting-signature`.

## Error Handling

Error handling follows the existing SIP rules but becomes more explicit:

- provider configuration missing -> explicit unavailable/degraded handling, never mock-happy-path;
- live quote failure -> either failed or degraded preview according to the documented fallback rule;
- live simulation failure -> failed or degraded state, never "mock success";
- contract mismatch -> fail explicitly rather than using `any` or coercion.

## Testing Strategy

Testing stays behavior-first and focuses on the repaired boundaries.

Priority tests:

- provider failure does not yield success-like simulation or preview state;
- message contracts are type-aligned and serializable;
- `actions / bundle` intent objects pass through parsing, risk, preview, and UI state correctly;
- `awaiting-signature` is unreachable after simulation failure;
- degraded/fallback preview states remain visually distinct from verified success paths;
- dev/test-only mocks do not leak into production runtime code paths.

## Risks

### Risk 1: Contract Migration Touches Many Files

Mitigation:

- update the authoritative docs first;
- keep the first typed payload scope narrow to the currently active swap path;
- use shared types as the migration spine rather than changing UI and router ad hoc.

### Risk 2: Removing Silent Mock Success Exposes More Failures During Development

Mitigation:

- preserve deterministic `test-only` and optional `dev-only` helpers;
- make degradation explicit instead of hiding it;
- update tests and local docs so the new behavior is expected.

### Risk 3: Bundle Preview Semantics Could Stay Vague

Mitigation:

- explicitly define the minimum preview invariants in docs;
- make `ExecutionPreview` fields and workflow entry conditions match those invariants.

## Acceptance Criteria

- No real provider or RPC key is hardcoded in repo source.
- Documentation and shared runtime types both describe `SIPIntent` as an `actions / bundle` object.
- No active runtime path relies on `payload: any` or `as any` to cross extension boundaries.
- Simulation failure cannot yield a success-looking preview or `awaiting-signature` state.
- Mock behavior is classified and restricted to test-only, dev-only, or explicit degraded runtime paths.
- The sidepanel no longer presents mock submission artifacts in the normal user flow.

## Rollout Notes

This should land as an internal repair sequence rather than a user-visible feature launch. The safest order is:

1. patch the highest-risk security/fallback behavior;
2. update docs and shared contracts;
3. align router, workflow, adapters, and UI;
4. refresh tests and remove stale mock-facing copy.

