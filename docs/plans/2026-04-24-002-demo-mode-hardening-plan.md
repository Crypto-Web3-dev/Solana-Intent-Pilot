# Demo Mode Hardening Plan

Date: 2026-04-24
Spec: `docs/superpowers/specs/2026-04-24-demo-mode-hardening-design.md`
Scope: `atomic-strategies` worktree MVP demo hardening

## Goal

Improve local MVP demo reliability without weakening the strict default runtime behavior that was introduced for production-oriented safety hardening.

## Principles

- Default mode stays strict.
- Demo helpers must be explicit and dev-only.
- No silent mock fallback is reintroduced into normal runtime paths.
- No contract churn unless required by the UI implementation.

## Implementation Units

### Unit 1: Add Demo Mode Gate

Objective:

- introduce a narrow, explicit demo-mode configuration helper

Tasks:

- add a small shared helper for determining whether demo mode is enabled
- ensure the gate is opt-in and does not activate automatically on provider failure
- scope the gate to UI/demo assist behavior only

Acceptance:

- normal mode behavior is unchanged
- demo mode is explicit in code and testable

### Unit 2: Remove Placeholder User-Facing URLs

Objective:

- eliminate obvious placeholder behavior from the demo experience

Tasks:

- replace `example.com` fallback in `extension/src/sidepanel/hooks/useSidePanelState.ts`
- replace `example.com` fallback in `extension/src/content/detect-context.ts`
- ensure unsupported-page recovery uses an intentional target or instruction

Acceptance:

- no user-visible `example.com` remains in active extension flows

### Unit 3: Add Demo Assist UX

Objective:

- make demo-time failure states easier to recover from without pretending success

Tasks:

- improve missing-wallet and unsupported-page guidance in sidepanel flow
- optionally expose a dev/demo-only assist path when appropriate
- keep workflow/risk semantics unchanged

Acceptance:

- operator gets clearer recovery guidance during demos
- no failed live parse/simulate path becomes success-like

### Unit 4: Add Demo Checklist Documentation

Objective:

- provide a repeatable runbook for local MVP demos

Tasks:

- create a short checklist doc covering env setup, wallet/browser setup, demo-mode behavior, and expected MVP failure cases
- link it to the current demo hardening spec if useful

Acceptance:

- repo contains a concise checklist that can be followed before a live demo

### Unit 5: Validate with Targeted Tests

Objective:

- verify that demo hardening did not weaken default safety semantics

Tasks:

- add or update tests for demo-mode gate behavior
- add or update tests for placeholder removal
- verify default wallet-missing path still fails explicitly
- verify demo assist behavior is not active by default

Acceptance:

- targeted tests pass
- normal strict-mode behavior remains intact

## Suggested Execution Order

1. Unit 1: add demo-mode gate
2. Unit 2: remove placeholder URLs
3. Unit 3: add demo assist UX
4. Unit 4: write demo checklist
5. Unit 5: run targeted validation

## Risks and Watchpoints

- accidentally making demo mode reachable in normal runtime
- reintroducing implicit mock behavior through convenience helpers
- changing workflow semantics instead of only improving demo guidance

## Done Criteria

- demo mode is explicit and dev-only
- no active user-facing placeholder URLs remain
- default strict behavior is preserved
- demo checklist is present in the repo
- targeted tests covering the new behavior pass
