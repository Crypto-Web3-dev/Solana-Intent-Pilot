# Engineering Cleanup and Release Readiness Implementation Plan

## Execution Status

Completed:

- Updated the docs index to point to the current post-basis entry point
- Added an explicit current-state note to the roadmap entry points
- Added execution-status blocks to the remaining completed quote plan and aligned the completed plan set

Validation:

- `rg -n "mock-first|exploratory|TODO|TBD" docs/README.md docs/roadmap/implementation-roadmap.md docs/roadmap/next-phase-plan.md`
- `Get-ChildItem -Recurse 'H:\\web3\\SIP\\docs\\superpowers\\plans' -Filter '*.md' | Select-String -Pattern '^## Execution Status'`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the docs and roadmap with the implementation that has already shipped, so the repo has a cleaner canonical entry point and fewer stale or contradictory references.

**Architecture:** This slice is documentation-only. It updates the docs index, roadmap language, and execution-status notes in completed plan files without changing runtime code. The result should make it obvious what is done, what remains, and where future work should start.

**Tech Stack:** Markdown, repository docs, shell-based verification.

---

### Task 1: Update the docs index and roadmap entry points

**Files:**
- Modify: `docs/README.md`
- Modify: `docs/roadmap/implementation-roadmap.md`
- Modify: `docs/roadmap/next-phase-plan.md`

- [ ] **Step 1: Write the failing check**

```powershell
rg -n "mock-first|exploratory|TODO|TBD" docs/README.md docs/roadmap/implementation-roadmap.md docs/roadmap/next-phase-plan.md
```

Expected: the current docs still contain wording that reads like the project is earlier in the lifecycle than it really is.

- [ ] **Step 2: Run the check to verify the current wording is stale**

Run:

```powershell
rg -n "mock-first|exploratory|TODO|TBD" docs/README.md docs/roadmap/implementation-roadmap.md docs/roadmap/next-phase-plan.md
```

Expected: one or more matches.

- [ ] **Step 3: Write the minimal implementation**

Update the docs index and roadmap files so they:

- point readers to the current implementation state
- distinguish completed foundation work from remaining roadmap work
- avoid describing shipped behavior as if it is still speculative

Example wording updates:

```md
- `docs/README.md`: mention that `docs/roadmap/next-phase-plan.md` is the current post-basis planning entry point
- `docs/roadmap/implementation-roadmap.md`: keep the historical roadmap, but note that the foundation and several later slices have already shipped
- `docs/roadmap/next-phase-plan.md`: describe the remaining roadmap as the active entry point for future work
```

- [ ] **Step 4: Run the check to verify it passes**

Run:

```powershell
rg -n "mock-first|exploratory|TODO|TBD" docs/README.md docs/roadmap/implementation-roadmap.md docs/roadmap/next-phase-plan.md
```

Expected: no stale lifecycle wording in these entry docs.

- [ ] **Step 5: Commit**

```bash
git add docs/README.md docs/roadmap/implementation-roadmap.md docs/roadmap/next-phase-plan.md
git commit -m "docs: align roadmap entry points with shipped implementation"
```

### Task 2: Add execution-status notes to completed plan docs

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-context-aware-openai-intent-parsing.md`
- Modify: `docs/superpowers/plans/2026-04-19-context-aware-clarification-confidence.md`
- Modify: `docs/superpowers/plans/2026-04-19-context-driven-mint-resolution-guardrails.md`
- Modify: `docs/superpowers/plans/2026-04-19-context-driven-clarification-payloads.md`
- Modify: `docs/superpowers/plans/2026-04-19-clarification-payload-ui-consumption.md`
- Modify: `docs/superpowers/plans/2026-04-19-jupiter-quote-preview.md`
- Modify: `docs/superpowers/plans/2026-04-19-execution-experience-real-context.md`
- Modify: `docs/superpowers/plans/2026-04-19-execution-preview-trueification.md`
- Modify: `docs/superpowers/plans/2026-04-19-transaction-submission-lifecycle.md`
- Modify: `docs/superpowers/plans/2026-04-19-wasm-risk-engine.md`
- Modify: `docs/superpowers/plans/2026-04-19-demo-experience-polish.md`

- [ ] **Step 1: Write the failing check**

```powershell
rg -n "^## Execution Status|^Completed:|^Validation:" docs/superpowers/plans/2026-04-19-*.md
```

Expected: some completed plans already have status notes, but the set is not uniformly complete or consistent.

- [ ] **Step 2: Run the check to identify gaps**

Run:

```powershell
rg -n "^## Execution Status|^Completed:|^Validation:" docs/superpowers/plans/2026-04-19-*.md
```

Expected: identify which completed plan docs still need a concise status note or wording alignment.

- [ ] **Step 3: Write the minimal implementation**

For each completed plan file listed above, add a short top-of-file `Execution Status` block that states:

- what shipped
- what fallback / guardrail remains
- what validation passed

Use the same concise format across the files so readers can scan them quickly.

Example:

```md
## Execution Status

Completed:

- Added ...
- Kept ...

Validation:

- `pnpm -C extension test`
- `pnpm -C extension build`
```

- [ ] **Step 4: Run the check to verify it passes**

Run:

```powershell
rg -n "^## Execution Status|^Completed:|^Validation:" docs/superpowers/plans/2026-04-19-*.md
```

Expected: all completed plans have a status block.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-*.md
git commit -m "docs: add execution status to completed plans"
```

### Task 3: Verify docs consistency and update the plan status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-engineering-cleanup-release-readiness.md`

- [ ] **Step 1: Run the docs consistency check**

Run:

```powershell
rg -n "mock-first|exploratory|TODO|TBD" docs
rg -n "^## Execution Status|^Completed:|^Validation:" docs/superpowers/plans/2026-04-19-*.md
```

Expected: the active docs entry points are clean, and completed plans have visible execution status blocks.

- [ ] **Step 2: Run a final sanity check**

Run:

```powershell
git status --short
```

Expected: only the intended docs files are modified.

- [ ] **Step 3: Update the plan with execution status**

Add a short `Execution Status` note to the top of this plan recording:

- the docs entry points that were updated
- the completed plans that received status notes
- the verification commands that passed

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-engineering-cleanup-release-readiness.md
git commit -m "docs(plan): record engineering cleanup execution status"
```
