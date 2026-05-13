# Engineering Cleanup and Release Readiness Design

## Goal

Align the SIP documentation set with the implementation that has already shipped, so the repo has a clean canonical entry point, accurate stage descriptions, and fewer stale mock-first or in-progress references.

## Why This Slice

The product work is now functionally complete enough that the remaining value is mostly in accuracy and maintainability:

- several roadmap and plan docs still describe work as if it is in progress
- the docs entry points can be clearer about what is now the canonical implementation entrance
- completed slices should be easy to recognize without re-reading every prior design note

This slice is intentionally non-behavioral. It updates documentation and release-facing wording only.

## Scope

In scope:

- align docs entry points with the current implementation state
- make roadmap wording reflect completed slices and remaining work more clearly
- add execution status notes to the relevant plan docs where needed
- remove stale mock-first / in-progress phrasing that now conflicts with shipped behavior

Out of scope:

- changing extension runtime behavior
- changing workflow contracts
- changing UI behavior
- removing intentional fallback code
- rewriting the product roadmap

## Existing Constraints

This slice must preserve the current implementation truth:

- mock fallback remains intentionally present in live-first adapters
- the workflow architecture is still `Background`-first
- `SecurityReport.source` and other runtime contracts are already in use
- the roadmap should describe what remains, not re-litigate what has shipped

## Recommended Approach

### Option 1: Only touch the top-level docs index

Pros:

- very small
- low risk

Cons:

- leaves a lot of stale wording in place
- does not clearly communicate the current implementation status

### Option 2: Update the docs index, roadmap entry points, and plan execution statuses

Pros:

- keeps docs and implementation aligned
- gives future work a cleaner entry point
- removes the most confusing stale wording without changing product code

Cons:

- touches several documentation files

### Option 3: Rewrite the whole docs tree for consistency

Pros:

- theoretically comprehensive

Cons:

- too large for a cleanup slice
- high churn, low direct product value

Recommendation: Option 2.

## Design

### 1. Canonical docs entry point

Update the docs index so that the recommended reading order reflects the current implementation state and the roadmap points to the new post-basis entry point instead of implying the project is still at the exploratory stage.

### 2. Roadmap wording

Update the roadmap and next-phase plan wording so they clearly distinguish:

- completed foundation work
- current remainder work
- already-shipped demo polish and execution slices

The roadmap should remain useful as a planning artifact without contradicting the current codebase.

### 3. Plan execution statuses

For the major superpowers plan docs that have already been executed, ensure they include a brief execution status note near the top so readers can tell:

- what shipped
- what fallback or guardrail remains
- what validation passed

### 4. Keep behavior documents authoritative

Do not change the meaning of runtime docs unless the implementation already changed. This slice should only remove stale wording, not reshape contracts.

## Testing Strategy

Since this slice is documentation-only, validation should focus on:

- searching for stale phrases that no longer match implementation reality
- confirming the updated docs entry points and status notes exist
- verifying there are no contradictory references to work that has already shipped

Recommended checks:

- `rg -n "mock-first|in progress|TODO|TBD" docs`
- `rg -n "Execution Status|canonical|roadmap" docs/superpowers/plans docs/roadmap docs/README.md`

## Files

- Modify: `docs/README.md`
- Modify: `docs/roadmap/implementation-roadmap.md`
- Modify: `docs/roadmap/next-phase-plan.md`
- Possibly modify: `docs/roadmap/demo-script.md`
- Possibly modify: `docs/roadmap/demo-checklist.md`
- Possibly modify: several `docs/superpowers/plans/*.md` files that already have execution status notes but need small wording alignment

## Risks

- over-updating docs could create churn without adding clarity
- removing too much “exploratory” language could make it harder to understand the historical progression
- documentation should not drift away from the actual code under the guise of cleanup

## Success Criteria

- The docs index and roadmap are consistent with the current implementation state
- Completed plan docs clearly show execution status where relevant
- Obvious stale or contradictory mock-first wording is removed
- No runtime behavior changes are introduced
