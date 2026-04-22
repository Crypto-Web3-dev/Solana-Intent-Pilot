# Wasm Risk Engine with Visible Fallback Implementation Plan

## Execution Status

Completed:

- Added a visible `source` marker to `SecurityReport`
- Implemented a Wasm-first risk adapter with policy fallback
- Rendered the active risk source in the Side Panel risk card
- Verified the extension with TypeScript, tests, and build

Fallback behavior still in place:

- If Wasm cannot load or produce a valid report, the policy engine is used
- The UI still renders a valid risk report for fallback results

Validation:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Wasm-first risk engine with explicit policy fallback, and make the active risk source visible in both the runtime report and the Side Panel UI.

**Architecture:** `background/risk-adapter.ts` becomes a small composed entry point that tries a Wasm risk engine first and falls back to the current policy engine when Wasm cannot load or run. The shared `SecurityReport` contract gains a minimal source marker so the UI can show whether the current result came from Wasm or fallback policy logic. The workflow state machine stays unchanged; only the risk implementation and its visible rendering are updated.

**Tech Stack:** TypeScript, React, Plasmo, Vitest, WebAssembly loading via browser/runtime fetch.

---

### Task 1: Extend the shared risk contract with a visible source marker

**Files:**
- Modify: `extension/src/shared/risk.ts`
- Modify: `extension/tests/shared/contracts.test.ts`
- Modify: `docs/api/runtime-contracts.md`
- Possibly modify: `docs/security/mvp-risk-policy.md`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import type { SecurityReport } from "../../src/shared/risk";

describe("SecurityReport", () => {
  it("requires a visible engine source", () => {
    const report: SecurityReport = {
      source: "wasm",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Policy checks passed"
    };

    expect(report.source).toBe("wasm");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- contracts.test.ts`
Expected: TypeScript or Vitest failure because `SecurityReport` does not yet include `source`.

- [x] **Step 3: Write the minimal implementation**

```ts
export type RiskEngineSource = "wasm" | "policy-fallback";

export interface SecurityReport {
  source: RiskEngineSource;
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: SecurityCheck[];
  summary: string;
}
```

Update the contract docs to say that the UI must show which engine produced the report, and that fallback remains valid but visible.

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- contracts.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/shared/risk.ts extension/tests/shared/contracts.test.ts docs/api/runtime-contracts.md docs/security/mvp-risk-policy.md
git commit -m "feat: add visible risk engine source contract"
```

### Task 2: Build a Wasm-first risk adapter with policy fallback

**Files:**
- Modify: `extension/src/background/risk-adapter.ts`
- Create: `extension/src/background/wasm-risk-engine.ts`
- Modify: `extension/src/background/runtime-services.ts`
- Create: `extension/tests/background/risk-adapter.test.ts`
- Possibly modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createDefaultRiskAdapter } from "../../src/background/risk-adapter";
import type { SIPIntent } from "../../src/shared/intent";

const intent: SIPIntent = {
  intent: "SWAP",
  confidence: 0.92,
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "JUP6LkbZbjS1jKKwapdHq8B3XQ2dJ6q7x4D6hT7Q1a",
    amount: "1000000",
    amountMode: "exact",
    slippageBps: 100,
    platform: "x.com"
  },
  metadata: {
    reasoning: "Test intent",
    requiresRiskScan: true,
    sourceContext: ["x.com"],
    needsClarification: false
  }
};

describe("risk adapter", () => {
  it("reports the active engine source", async () => {
    const adapter = createDefaultRiskAdapter();
    const report = await adapter.scanRisk(intent);
    expect(report.source).toBe("wasm");
  });

  it("falls back to policy when wasm is unavailable", async () => {
    const adapter = createDefaultRiskAdapter({
      loadWasmRiskEngine: async () => null
    });
    const report = await adapter.scanRisk(intent);
    expect(report.source).toBe("policy-fallback");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- risk-adapter.test.ts`
Expected: FAIL because `createDefaultRiskAdapter` does not yet accept an injected Wasm loader and `SecurityReport` does not yet expose `source`.

- [x] **Step 3: Write the minimal implementation**

```ts
export interface RiskAdapterDependencies {
  loadWasmRiskEngine?: () => Promise<WasmRiskEngine | null>;
}

export function createDefaultRiskAdapter(
  dependencies: RiskAdapterDependencies = {}
): RiskAdapter {
  return {
    async scanRisk(intent: SIPIntent): Promise<SecurityReport> {
      const wasmEngine = dependencies.loadWasmRiskEngine
        ? await dependencies.loadWasmRiskEngine()
        : await loadDefaultWasmRiskEngine();

      if (wasmEngine) {
        const report = await wasmEngine.scanRisk(intent);
        if (isValidSecurityReport(report)) {
          return { ...report, source: "wasm" };
        }
      }

      return {
        ...buildPolicyReport(intent),
        source: "policy-fallback"
      };
    }
  };
}
```

Add a small `wasm-risk-engine.ts` module that:

```ts
export interface WasmRiskEngine {
  scanRisk(intent: SIPIntent): Promise<SecurityReport | null>;
}

export async function loadDefaultWasmRiskEngine(): Promise<WasmRiskEngine | null> {
  return null;
}
```

Keep the initial loader boring and explicit. It can return `null` until the module wiring is ready, but the adapter contract and fallback path must already be in place.

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- risk-adapter.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/background/risk-adapter.ts extension/src/background/wasm-risk-engine.ts extension/src/background/runtime-services.ts extension/tests/background/risk-adapter.test.ts
git commit -m "feat: add wasm-first risk adapter with fallback"
```

### Task 3: Surface the risk source in the Side Panel UI

**Files:**
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Modify: `extension/tests/sidepanel/risk-indicator.test.tsx`
- Possibly modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RiskIndicator } from "../../src/sidepanel/components/RiskIndicator";

describe("RiskIndicator", () => {
  it("shows the active engine source", () => {
    const html = renderToString(
      <RiskIndicator
        risk={{
          source: "policy-fallback",
          score: 60,
          level: "medium",
          blocking: false,
          checks: [],
          summary: "Policy checks returned warnings"
        }}
        phase="idle"
      />
    );

    expect(html).toContain("Risk source: policy-fallback");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- risk-indicator.test.tsx`
Expected: FAIL because the component does not yet render the source label.

- [x] **Step 3: Write the minimal implementation**

```tsx
export function RiskIndicator({ risk, phase }: { risk: SecurityReport | null; phase: WorkflowPhase }) {
  if (phase === "risk-checking") return <div>Risk: scanning...</div>;
  if (!risk) return <div>Risk: no report yet</div>;
  const sourceLabel = risk.source === "wasm" ? "Wasm" : "policy fallback";
  if (risk.level === "unknown") {
    return <div>Risk: unknown - data is incomplete <span>Risk source: {sourceLabel}</span></div>;
  }
  return (
    <div>
      <div>Risk: {risk.blocking ? `blocked - ${risk.summary}` : risk.level}</div>
      <div>Risk source: {sourceLabel}</div>
    </div>
  );
}
```

Keep the source label visually secondary so it supports the risk verdict instead of competing with it.

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- risk-indicator.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/RiskIndicator.tsx extension/tests/sidepanel/risk-indicator.test.tsx
git commit -m "feat: show active risk engine source in ui"
```

### Task 4: Verify the full extension build and update the plan with execution status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-wasm-risk-engine.md`

- [x] **Step 1: Run the focused tests**

Run:

```bash
pnpm -C extension test -- contracts.test.ts risk-adapter.test.ts risk-indicator.test.tsx
```

Expected: PASS.

- [x] **Step 2: Run the full verification suite**

Run:

```bash
pnpm -C extension exec tsc --noEmit --pretty false
pnpm -C extension test
pnpm -C extension build
```

Expected: all PASS.

- [x] **Step 3: Update the plan with execution status**

Add a short `Execution Status` note to the top of this plan that records:

- what shipped
- what fallback behavior remains in place
- what validation commands passed

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-wasm-risk-engine.md
git commit -m "docs(plan): record wasm risk engine execution status"
```
