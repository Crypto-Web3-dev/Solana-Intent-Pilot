# Demo Experience Polish Implementation Plan

## Execution Status

Completed:

- Tightened the Side Panel shell copy to read as demo-ready
- Made the detection bar narrate workflow progress more clearly
- Polished execution card copy for happy path, clarification, unsupported-page, and submitting states
- Kept blocked, failed, clarification, and unknown states visually distinct

Validation:

- `pnpm -C extension test -- sidepanel.test.tsx action-card.test.tsx risk-indicator.test.tsx`
- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the SIP Side Panel presentation so the happy path, blocked path, clarification path, and unknown-risk path are easier to demo without changing workflow semantics.

**Architecture:** Keep `Background` and the workflow state machine untouched. Refine only the Side Panel presentation layer and its tests so the existing states read more clearly, the primary CTA is more obvious, and the blocked / failed / clarification / unknown states are visually distinct. The panel should feel product-ready without hiding the underlying workflow truth.

**Tech Stack:** TypeScript, React, Plasmo, Vitest, server-rendered UI tests.

---

### Task 1: Tighten the Side Panel shell copy and section hierarchy

**Files:**
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Modify: `extension/src/sidepanel/components/DetectionBar.tsx`
- Modify: `extension/tests/sidepanel/sidepanel.test.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SidePanelPage } from "../../src/sidepanel/pages/SidePanelPage";

describe("SidePanelPage", () => {
  it("renders demo-friendly section copy", () => {
    const html = renderToString(<SidePanelPage />);

    expect(html).toContain("SIP Side Panel");
    expect(html).toContain("Request");
    expect(html).toContain("Workflow State");
    expect(html).toContain("Intent + Risk");
    expect(html).toContain("Execution");
    expect(html).toContain("Demo-ready workflow panel");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- sidepanel.test.tsx`
Expected: FAIL because the current shell copy still reads like a mock workflow panel.

- [x] **Step 3: Write the minimal implementation**

```tsx
<p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
  Demo-ready workflow panel for intent parsing, risk checks, and execution preview.
</p>
```

Update `DetectionBar` so the phase labels feel like progress narration rather than debug text:

```tsx
function phaseLabel(phase: WorkflowPhase) {
  if (phase === "parsing") return "Parsing request";
  if (phase === "risk-checking") return "Scanning token risk";
  if (phase === "quoting") return "Preparing quote";
  if (phase === "simulating") return "Simulating outcome";
  if (phase === "awaiting-signature") return "Preview ready";
  if (phase === "submitting") return "Submitting transaction";
  if (phase === "confirmed") return "Transaction confirmed";
  if (phase === "blocked") return "Blocked by policy";
  if (phase === "failed") return "Execution failed";
  return "Ready for a new request";
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- sidepanel.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/sidepanel/pages/SidePanelPage.tsx extension/src/sidepanel/components/DetectionBar.tsx extension/tests/sidepanel/sidepanel.test.tsx
git commit -m "feat: tighten side panel shell copy"
```

### Task 2: Make the execution card state copy more polished and action-oriented

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/tests/sidepanel/action-card.test.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ActionCard } from "../../src/sidepanel/components/ActionCard";

describe("ActionCard", () => {
  it("renders a demo-friendly confirmation copy for the happy path", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000"
        }}
        phase="awaiting-signature"
        reason={null}
        clarification={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onFailSubmit={() => {}}
        onSettle={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Preview is ready. Waiting for wallet confirmation.");
    expect(html).toContain("Confirm Signature");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: FAIL if the copy still feels scaffold-like or the state text is not aligned.

- [x] **Step 3: Write the minimal implementation**

```tsx
function phaseMessage(phase: WorkflowPhase, reason: WorkflowReason | string | null) {
  if (phase === "blocked" && reason === "unsupported-page") {
    return "Signing is only available on normal web pages. Please switch to an http(s) tab.";
  }
  if (phase === "blocked") {
    return "Execution is blocked by policy.";
  }
  if (phase === "failed") {
    return `Execution failed${reason ? `: ${reason}` : ""}`;
  }
  if (phase === "idle" && reason === "clarification-required") {
    return "More information is needed before we can continue.";
  }
  if (phase === "awaiting-signature") {
    return "Preview is ready. Waiting for wallet confirmation.";
  }
  if (phase === "submitting") {
    return "Transaction is being submitted.";
  }
  if (phase === "confirmed") {
    return "Transaction confirmed.";
  }
  return `Phase: ${phase}`;
}
```

Keep the CTA order consistent:

```tsx
{phase === "awaiting-signature" ? (
  <div>
    <button onClick={onConfirm} disabled={!isWalletReady || isSigning}>
      {isSigning ? "Confirming..." : "Confirm Signature"}
    </button>
    <button onClick={onCancel}>Mock Cancel Signature</button>
  </div>
) : null}
```

For unsupported pages, keep the explicit action:

```tsx
{isUnsupportedPage ? (
  <div>
    <button onClick={onOpenNormalPage}>Open normal webpage</button>
  </div>
) : null}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/ActionCard.tsx extension/tests/sidepanel/action-card.test.tsx
git commit -m "feat: polish execution card demo copy"
```

### Task 3: Make risk states and unknown-source presentation more demo-friendly

**Files:**
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Modify: `extension/tests/sidepanel/risk-indicator.test.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RiskIndicator } from "../../src/sidepanel/components/RiskIndicator";

describe("RiskIndicator", () => {
  it("renders blocked and unknown states with distinct language", () => {
    const blocked = renderToString(
      <RiskIndicator
        risk={{
          source: "policy-fallback",
          score: 10,
          level: "high",
          blocking: true,
          checks: [],
          summary: "Blocked token"
        }}
        phase="idle"
      />
    );

    const unknown = renderToString(
      <RiskIndicator
        risk={{
          source: "policy-fallback",
          score: 0,
          level: "unknown",
          blocking: false,
          checks: [],
          summary: "Insufficient data"
        }}
        phase="idle"
      />
    );

    expect(blocked).toContain("Risk: blocked - Blocked token");
    expect(unknown).toContain("Risk: unknown - data is incomplete");
    expect(unknown).toContain("Risk source:");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- risk-indicator.test.tsx`
Expected: FAIL if the risk card language is still too scaffold-like or the source label is missing from unknown state.

- [x] **Step 3: Write the minimal implementation**

```tsx
if (risk.level === "unknown") {
  return (
    <div>
      <div>Risk: unknown - data is incomplete</div>
      <div>Risk source: {sourceLabel}</div>
    </div>
  );
}

if (risk.blocking) {
  return (
    <div>
      <div>Risk: blocked - {risk.summary}</div>
      <div>Risk source: {sourceLabel}</div>
    </div>
  );
}
```

Keep the source label visually secondary and never success-like.

- [x] **Step 4: Run the test to verify it passes**

Run: `pnpm -C extension test -- risk-indicator.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add extension/src/sidepanel/components/RiskIndicator.tsx extension/tests/sidepanel/risk-indicator.test.tsx
git commit -m "feat: polish risk state presentation"
```

### Task 4: Verify the full panel behavior and update the plan status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-demo-experience-polish.md`

- [x] **Step 1: Run the focused side panel tests**

Run:

```bash
pnpm -C extension test -- sidepanel.test.tsx action-card.test.tsx risk-indicator.test.tsx
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

Add a short `Execution Status` note to the top of this plan recording:

- the copy and hierarchy updates
- the state-specific CTA and risk presentation updates
- the validation commands that passed

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-04-19-demo-experience-polish.md
git commit -m "docs(plan): record demo polish execution status"
```
