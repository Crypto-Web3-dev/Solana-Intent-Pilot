# Execution Preview Trueification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the execution preview path explicitly live-first while preserving deterministic fallback behavior and stable UI mapping for quote, simulation, and unknown risk states.

**Architecture:** Keep `quote-adapter`, `simulation-adapter`, and `preview-adapter` separate. Tighten their tests and UI-facing semantics so the live path is the default, fallback is explicit, and partial failures are not mistaken for a clean success.

**Tech Stack:** TypeScript, React, Vitest

## Execution Status

Completed on `2026-04-19`.

- Quote and simulation adapters now have explicit live-path tests plus fallback coverage.
- Preview composition is covered by a dedicated adapter test.
- The Side Panel keeps `unknown` risk visually distinct from success.
- Workflow routing remains unchanged while preview semantics are now better covered.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Add failing tests for preview trueification behavior

**Files:**
- Modify: `extension/tests/background/quote-adapter.test.ts`
- Modify: `extension/tests/background/simulation-adapter.test.ts`
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Add a live quote mapping test**

```ts
it("maps a live Jupiter quote response into QuoteResult", async () => {
  // mock fetch returns inAmount/outAmount and adapter returns QuoteResult
});
```

- [x] **Step 2: Add a live simulation mapping test**

```ts
it("maps a live RPC preflight response into SimulationResult", async () => {
  // mock fetch returns a usable preflight payload and adapter returns a summary
});
```

- [x] **Step 3: Add a quote fallback test**

```ts
it("falls back to the mock quote adapter when live quote fetch fails", async () => {
  // fetch rejects and fallback adapter result is returned
});
```

- [x] **Step 4: Add a simulation fallback test**

```ts
it("falls back to the mock simulation adapter when live simulation fetch fails", async () => {
  // fetch rejects and fallback adapter result is returned
});
```

- [x] **Step 5: Add a preview failure mapping test**

```ts
it("treats preview composition failure as a failed workflow", async () => {
  // simulate quote or simulation failure and expect failed state with simulation-failed or quote-failed
});
```

- [x] **Step 6: Run focused tests to verify they fail**

Run:

```bash
pnpm -C extension test -- quote-adapter.test.ts
pnpm -C extension test -- simulation-adapter.test.ts
pnpm -C extension test -- workflow-engine.test.ts
```

Expected: FAIL because the new live-first and failure-mapping assertions are not fully covered yet

### Task 2: Tighten quote live-first behavior

**Files:**
- Modify: `extension/src/background/quote-adapter.ts`
- Modify: `extension/tests/background/quote-adapter.test.ts`

- [x] **Step 1: Keep live-first Jupiter mapping explicit**

```ts
export function createJupiterQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): QuoteAdapter {
  // live quote fetch, strict response validation, explicit failure on unusable payloads
}
```

- [x] **Step 2: Keep fallback order boring and deterministic**

```ts
export function createDefaultQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  fallbackAdapter?: QuoteAdapter;
}): QuoteAdapter {
  // live adapter first, fallback only on failure
}
```

- [x] **Step 3: Run focused quote tests**

Run: `pnpm -C extension test -- quote-adapter.test.ts`
Expected: PASS

### Task 3: Tighten simulation live-first behavior

**Files:**
- Modify: `extension/src/background/simulation-adapter.ts`
- Modify: `extension/tests/background/simulation-adapter.test.ts`

- [x] **Step 1: Keep live preflight mapping explicit**

```ts
export function createRpcPreflightSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): SimulationAdapter {
  // live preflight fetch, strict response validation, explicit failure on unusable payloads
}
```

- [x] **Step 2: Keep fallback order deterministic**

```ts
export function createDefaultSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
  fallbackAdapter?: SimulationAdapter;
}): SimulationAdapter {
  // live adapter first, fallback only on failure
}
```

- [x] **Step 3: Run focused simulation tests**

Run: `pnpm -C extension test -- simulation-adapter.test.ts`
Expected: PASS

### Task 4: Make preview composition failure explicit

**Files:**
- Modify: `extension/src/background/preview-adapter.ts`
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Keep preview composition limited to quote + simulation**

```ts
const quote = await quoteAdapter.getQuote(intent);
const simulation = await simulationAdapter.simulate(intent);
return combinePreview(requestId, quote, simulation);
```

- [x] **Step 2: Ensure failures still map to failed workflow states**

```ts
engine.handleFailure(requestId, "simulation-failed");
```

- [x] **Step 3: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 5: Reflect live-first and unknown semantics in the UI if needed

**Files:**
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/tests/sidepanel/action-card.test.tsx`

- [x] **Step 1: Keep unknown risk visually distinct**

```ts
if (risk.level === "unknown") {
  return "Risk is unknown. Please review carefully.";
}
```

- [x] **Step 2: Keep preview failure distinct from success**

```ts
if (phase === "failed") {
  return "Preview failed.";
}
```

- [x] **Step 3: Run focused UI tests**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: PASS

### Task 6: Verify the full slice and write back execution status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-execution-preview-trueification.md`

- [x] **Step 1: Run type-check**

Run: `pnpm -C extension exec tsc --noEmit --pretty false`
Expected: PASS

- [x] **Step 2: Run full extension tests**

Run: `pnpm -C extension test`
Expected: PASS

- [x] **Step 3: Run production build**

Run: `pnpm -C extension build`
Expected: PASS

- [x] **Step 4: Write execution status back into the plan**

Add an `Execution Status` section summarizing:

- completed date
- live-first preview behavior
- fallback coverage
- UI semantics for unknown and failure states
- verification commands run
