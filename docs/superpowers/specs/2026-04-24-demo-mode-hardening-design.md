# Demo Mode Hardening Design

Date: 2026-04-24
Scope: `atomic-strategies` worktree MVP demo hardening

## Goal

Make the current extension more reliable for local MVP demos without weakening the default runtime semantics that were recently hardened for production-readiness.

This change is not a backend migration and not a production launch effort. It is a demo-focused polish pass for:

- explicit demo-only assistance
- removal of obvious placeholder behavior
- a repeatable demo checklist

## Non-Goals

- Reintroducing silent mock fallback into default runtime paths
- Hiding missing provider or wallet errors in normal mode
- Reworking the core workflow, risk policy, or message contracts
- Moving provider secrets off the client

## Desired Outcome

After this change:

- normal mode still fails explicitly when required external dependencies are missing
- demo mode is an explicit opt-in path for local presentations
- the UI no longer exposes `example.com` placeholder behavior
- the repo includes a short checklist for reliable live demos

## Approach

Use a mixed model:

- keep the existing default runtime behavior strict
- add a development-only demo mode gate
- use the gate only for presentation helpers, not for core trust decisions

This keeps the current trust boundaries intact while giving the operator a controlled way to avoid obvious demo breakpoints.

## Design

### 1. Demo Mode Gate

Introduce a development-only configuration switch for demo mode.

Requirements:

- It must be explicit and easy to identify in code.
- It must not activate automatically just because a provider is missing.
- It must be unavailable in production-intended defaults.

Initial intended usage:

- sidepanel presentation helpers
- wallet-missing demo handling
- guidance for unsupported-page recovery

It must not:

- change risk decisions
- change workflow transition rules
- convert failed live simulation into success
- convert failed intent parsing into a mock success path

### 2. Placeholder Removal

Replace obvious placeholder behavior that weakens demo quality.

Targets:

- `extension/src/sidepanel/hooks/useSidePanelState.ts`
- `extension/src/content/detect-context.ts`

Requirements:

- no `example.com` fallback in user-visible flows
- unsupported-page recovery should point to a real, intentional destination or show an explicit instruction
- default context snapshots should look credible in logs and UI

### 3. Demo Assist Behavior

Demo mode may provide operator assistance, but only as explicit, visible behavior.

Allowed examples:

- clearer CTA or message when a normal webpage is required
- clearer recovery guidance when no wallet provider is available
- optional dev-only shortcut that keeps the presentation moving without pretending that a real wallet signed

Disallowed examples:

- silent automatic mock signing in normal mode
- silent automatic mock parsing after model failure
- hiding degraded or failed states behind success-like copy

### 4. Documentation

Add a short demo checklist document.

The checklist should cover:

- required env variables for a live demo
- recommended browser/wallet setup
- what demo mode changes and does not change
- which steps are safe to demo without a wallet
- expected failure modes that are acceptable for MVP

## Data and Flow Impact

This design should avoid contract churn.

Expected impact:

- no changes to `shared/` runtime contracts
- no changes to risk policy outputs
- no new workflow phases
- only local UI/control-flow changes plus a demo checklist doc

## Testing

Add or update targeted tests for:

- demo mode gate behavior
- no `example.com` user-facing fallback remains
- normal mode still throws on missing wallet provider
- demo-only behavior is not reachable by default

## Risks

The main risk is accidentally reintroducing implicit mock behavior under the name of demo support.

Mitigation:

- keep demo mode explicit
- keep it narrowly scoped
- keep default mode strict
- verify through tests that normal mode still fails explicitly

## Acceptance Criteria

1. Default behavior remains strict for missing parser, wallet, and simulation dependencies.
2. No user-visible `example.com` placeholder remains in the extension flow.
3. Demo assistance is opt-in and clearly scoped to dev/demo usage.
4. No demo helper produces a success-like state for failed live parsing or simulation.
5. A short demo checklist exists in the repo and reflects the implemented behavior.
