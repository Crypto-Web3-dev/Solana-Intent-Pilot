# Wasm Risk Engine with Visible Fallback Design

## Goal

Replace the current policy-only risk adapter with a Wasm-first risk engine that preserves the existing fallback behavior, while making the active risk source visible in the UI and runtime report.

## Why This Slice

SIP already has a stable risk boundary:

- `SecurityReport` is the UI-facing risk contract
- `risk-adapter.ts` is the current policy-based implementation
- `mvp-risk-policy.md` defines the decision semantics

The remaining gap is implementation, not intent:

- the risk adapter is still entirely policy-driven
- there is no Wasm loading path yet
- the UI cannot tell whether the current report came from Wasm or fallback policy logic

This slice introduces the first local executable risk backend without breaking the current demo-friendly behavior.

## Scope

In scope:

- add a Wasm-backed risk engine path
- keep the existing policy-based adapter as a fallback
- make the active risk source visible in `SecurityReport`
- surface the risk source in the Side Panel
- preserve current `RiskLevel`, `blocking`, and `checks` semantics
- add deterministic tests for Wasm success, fallback, and source labeling

Out of scope:

- changing the overall workflow state machine
- changing intent parsing behavior
- changing quote or simulation providers
- changing wallet signing flow
- adding remote or server-hosted risk services

## Existing Constraints

This slice must stay aligned with the current contract and policy docs:

- `unknown` remains a risk label, not a workflow phase
- `needsClarification` remains intent metadata, not a workflow phase
- MVP still defaults to no high-risk override
- `SecurityReport` must remain serializable and UI-friendly
- the current policy semantics in `mvp-risk-policy.md` remain the fallback baseline

## Recommended Approach

### Option 1: Keep policy-only risk logic

Pros:

- no implementation risk
- no Wasm loading complexity

Cons:

- does not move SIP toward the planned local executable risk engine
- leaves the current risk layer as a pure placeholder for later work

### Option 2: Add Wasm as an internal implementation detail with silent fallback

Pros:

- preserves current behavior
- minimizes UI changes

Cons:

- users and testers cannot tell whether Wasm is actually running
- fallback and live behavior are indistinguishable
- harder to debug and validate

### Option 3: Add Wasm-first risk execution with explicit source labeling and policy fallback

Pros:

- keeps the current safety net
- makes runtime behavior observable
- allows UI and tests to distinguish live Wasm execution from fallback
- best matches the current roadmap slice and the requested product direction

Cons:

- requires a small contract extension for source visibility
- needs one extra UI state mapping

Recommendation: Option 3.

## Design

### 1. Risk engine layering

Keep the existing `RiskAdapter` interface and make it a composed entry point:

- `createWasmRiskAdapter()` tries the local Wasm engine first
- `createPolicyRiskAdapter()` remains the deterministic fallback
- `createDefaultRiskAdapter()` returns the Wasm-first wrapper

The wrapper should own the fallback decision. Callers should continue to depend on one adapter and stay oblivious to the implementation path.

### 2. Risk source visibility

Extend the risk report with a small source marker so the UI can show where the answer came from.

The report should distinguish:

- Wasm execution succeeded
- Wasm loading or initialization failed and policy fallback was used

This source marker should be simple and stable, for example:

```ts
export type RiskEngineSource = "wasm" | "policy-fallback";
```

and:

```ts
export interface SecurityReport {
  source: RiskEngineSource;
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: SecurityCheck[];
  summary: string;
}
```

### 3. Wasm engine responsibilities

The Wasm-backed implementation should:

- accept a serialized `SIPIntent`
- return the same `SecurityReport` shape as the policy engine
- map rule failures into the same `level`, `blocking`, and `checks` semantics
- fail explicitly when the module cannot be loaded, initialized, or invoked

The Wasm engine should not introduce a new UI-facing risk contract.

### 4. Fallback behavior

Fallback should happen when:

- the Wasm module is missing
- module loading fails
- initialization fails
- the Wasm invocation throws
- the Wasm result is missing required report fields

When fallback happens, the report should clearly say:

- the result came from policy fallback
- the policy decision is still valid

This keeps the app usable while making fallback observable.

### 5. UI behavior

The Side Panel should render the risk source directly in the risk card.

The UI must make the difference visible between:

- a report produced by Wasm
- a report produced by policy fallback

The source label should not replace the risk level. It should complement it.

### 6. Contract discipline

This slice should preserve current semantics:

- `high`, `medium`, `low`, and `unknown` keep their meaning
- `blocking` remains the execution gate
- `checks` remains the detail list

The only contract expansion should be the minimal source marker needed to show whether Wasm ran or fallback was used.

## Testing Strategy

Add tests for:

- Wasm path returns a valid `SecurityReport` with `source = "wasm"`
- Wasm load failure falls back to policy and reports `source = "policy-fallback"`
- Wasm invocation failure falls back to policy and reports `source = "policy-fallback"`
- policy fallback still preserves the existing `high` / `medium` / `low` / `unknown` semantics
- Side Panel risk card renders the source label distinctly

Tests should stay deterministic and not require a real Wasm binary for the fallback path. A minimal test Wasm module or a mocked module boundary is acceptable for the success-path coverage.

## Files

- Modify: `extension/src/shared/risk.ts`
- Modify: `extension/src/background/risk-adapter.ts`
- Possibly create: `extension/src/background/wasm-risk-engine.ts`
- Possibly modify: `extension/src/background/runtime-services.ts`
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Modify: `extension/tests/background/risk-adapter.test.ts`
- Modify: `extension/tests/sidepanel/risk-indicator.test.tsx`

## Risks

- adding a source field to `SecurityReport` is a runtime contract change and must be kept minimal
- Wasm loading in MV3 can fail for environment reasons, so fallback must remain first-class
- a noisy UI source label could distract from the actual risk result if rendered too prominently
- the Wasm module must not silently coerce invalid results into success-like reports

## Success Criteria

- The default risk path tries Wasm first
- Fallback to the current policy engine works automatically
- The UI shows whether the current report came from Wasm or policy fallback
- Existing risk semantics remain stable
- Tests cover both engine paths and the source label mapping
