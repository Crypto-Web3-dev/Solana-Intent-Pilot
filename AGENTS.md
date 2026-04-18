# SIP Engineering Conventions

This file defines the working agreements for implementing SIP from the current documentation set.

## Source of truth

- `docs/` is the authoritative source for stable product and architecture decisions.
- Before changing runtime behavior, align with:
  - `docs/architecture/workflow-state-machine.md`
  - `docs/api/runtime-contracts.md`
  - `docs/security/mvp-risk-policy.md`
- `learn/` is background material, not the implementation source of truth.

## Tech direction

- Language: TypeScript for extension code
- UI: React
- Extension shell: Plasmo
- Testing: Vitest
- First implementation slice is mock-first. Do not couple early skeleton work to real LLM, RPC, wallet, or Wasm integrations.

## Architecture rules

- `background/` is the only workflow orchestrator.
- `sidepanel/` renders state and sends user actions. It does not own workflow transitions.
- `content/` detects and emits context only.
- `shared/` is the single source of truth for runtime contracts.
- `unknown` is a risk label, not a workflow phase.
- `needsClarification` is intent metadata, not a workflow phase.

## Coding style

- Prefer simple, explicit TypeScript over clever abstractions.
- Prefer named exports for shared contracts and utilities.
- Prefer small, focused files with one clear responsibility.
- Prefer pure functions for state transitions, mapping, formatting, and policy logic.
- Avoid hidden side effects in helpers.
- Avoid premature generic abstractions.
- Keep data shapes serializable across extension boundaries.

## Naming

- Types and interfaces: `PascalCase`
- Functions and variables: `camelCase`
- React components: `PascalCase`
- Files:
  - contracts/types: noun-based, e.g. `intent.ts`, `messages.ts`
  - orchestrators: role-based, e.g. `workflow-engine.ts`, `message-router.ts`
  - hooks: `useX.ts`
- Use domain names that match `docs/` exactly:
  - `SIPIntent`
  - `SecurityReport`
  - `ExecutionPreview`
  - `WorkflowPhase`
  - `WorkflowReason`

## Function size and boundaries

- Target small functions that do one thing well.
- As a rule of thumb:
  - prefer functions under 30 lines
  - review carefully if a function grows beyond 50 lines
  - split immediately if a function mixes validation, orchestration, formatting, and side effects
- Keep React components thin; move non-visual logic into hooks or shared helpers.
- Keep workflow transition logic out of UI components.

## Comments

- Add comments sparingly.
- Comment intent, invariants, or non-obvious tradeoffs.
- Do not add comments that restate the code.
- Good places for comments:
  - why a workflow branch exists
  - why a risk rule is special-cased
  - why a mock shape intentionally mirrors a runtime contract

## Testing rules

- Follow TDD for behavior changes and new logic.
- Write the failing test first, verify it fails for the right reason, then implement the minimum code to pass.
- Prioritize tests for:
  - workflow transitions
  - runtime contract integrity
  - risk-policy decisions
  - UI state distinctions such as `blocked` vs `failed` vs clarification
- Prefer real behavior tests over mock-heavy unit tests when possible.
- Run extension tests via `pnpm -C extension test`.
- The extension test script uses `extension/scripts/run-vitest.mjs` instead of the default Vitest CLI config-loading path.
- Reason: in this environment, the default Vitest/Vite startup path can fail on Windows with `spawn EPERM` when it tries to create helper processes during config loading or worker setup.
- If tests fail only inside a sandboxed session, verify once in a less restricted environment before changing app code.

## Mock-first implementation rules

- Early mock services must return shapes that conform to `docs/api/runtime-contracts.md`.
- Do not invent UI-only response formats.
- Mock paths must at least cover:
  - happy path
  - clarification path
  - blocked path
  - failed path

## UI rules

- Get semantics right before polishing visuals.
- `blocked`, `failed`, and clarification states must render differently.
- `unknown` must never look like a success state.
- Avoid embedding business logic directly in presentation components.

## Error handling

- Fail explicitly with stable reasons where possible.
- Prefer typed reasons aligned with `WorkflowReason`.
- Do not silently coerce invalid runtime states into success-like UI.

## Refactoring guidance

- Refactor when it improves clarity for the current task.
- Do not perform unrelated large-scale restructuring.
- If a file starts accumulating multiple responsibilities, split by domain boundary rather than technical layer alone.

## Documentation updates

- If implementation changes a stable runtime contract or workflow decision, update `docs/` in the same workstream.
- Keep names in code aligned with names in the docs.

## Practical defaults

- ASCII by default
- Strict typing preferred over `any`
- Avoid adding dependencies unless they clearly reduce complexity
- Keep the first pass boring and easy to reason about
