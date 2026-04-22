# Clarification Payload UI Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render parser clarification payloads in the Side Panel so users can see why clarification is needed and what kind of token ambiguity was detected.

**Architecture:** Keep workflow behavior unchanged. Extend the Side Panel presentation layer to read the optional `clarification` payload from `SIPIntent.metadata` and render a category-aware clarification block inside the Action Card.

**Tech Stack:** React, TypeScript, Vitest

## Execution Status

Completed on `2026-04-19`.

- Side Panel now renders clarification payloads inside `ActionCard`.
- Clarification states show category-aware titles, deterministic messages, and candidate symbols when available.
- `useSidePanelState` now carries clarification payloads from parsed intent results into UI state.
- Workflow routing remains unchanged.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Add failing UI tests for clarification payload rendering

**Files:**
- Modify: `extension/tests/sidepanel/action-card.test.tsx`

- [x] **Step 1: Add a missing-output-mint rendering test**

```ts
it("shows a missing token candidate clarification message", () => {
  // render ActionCard with clarification.kind === "missing-output-mint"
  // expect the missing-token explanation to be visible
});
```

- [x] **Step 2: Add an ambiguous-output-mint rendering test**

```ts
it("shows candidate symbols for ambiguous token clarification", () => {
  // render ActionCard with clarification.kind === "ambiguous-output-mint"
  // expect candidate symbols to be visible
});
```

- [x] **Step 3: Add a fallback clarification rendering test**

```ts
it("falls back to the generic clarification message when no payload is present", () => {
  // render ActionCard with phase/reason only
});
```

- [x] **Step 4: Run focused UI tests to verify they fail**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: FAIL because clarification payload rendering does not exist yet

### Task 2: Extend the Action Card to render clarification payloads

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [x] **Step 1: Add clarification props**

```ts
import type { ClarificationPayload } from "../../shared/intent";

export function ActionCard({
  preview,
  phase,
  reason,
  clarification,
  walletStatus,
  isSigning,
  onConfirm,
  onCancel,
  onFailSubmit,
  onSettle,
  onOpenNormalPage
}: {
  preview: ExecutionPreview | null;
  phase: WorkflowPhase;
  reason: WorkflowReason | string | null;
  clarification?: ClarificationPayload | null;
  walletStatus: WalletStatus;
  isSigning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onFailSubmit: () => void;
  onSettle: () => void;
  onOpenNormalPage: () => void;
}) {
```

- [x] **Step 2: Add a deterministic clarification renderer**

```ts
function clarificationMessage(kind: ClarificationPayload["kind"]) {
  switch (kind) {
    case "missing-output-mint":
      return "I still need to know which token you want.";
    case "unknown-output-mint":
      return "I found token hints, but not enough to safely identify one token.";
    case "ambiguous-output-mint":
      return "I found multiple possible token candidates.";
    case "underspecified-request":
      return "I need a more specific request before I can continue.";
  }
}
```

- [x] **Step 3: Render clarification before confirm controls**

```tsx
{phase === "idle" && reason === "clarification-required" ? (
  <div>
    <div>Clarification needed</div>
    <div>{clarificationMessage(clarification?.kind ?? "underspecified-request")}</div>
    {clarification?.candidateSymbols?.length ? (
      <div>Possible tokens: {clarification.candidateSymbols.join(", ")}</div>
    ) : null}
  </div>
) : null}
```

- [x] **Step 4: Keep existing blocked and failed rendering intact**

Do not change:

- unsupported-page button
- wallet status feedback
- confirm / cancel controls
- mock submission controls

- [x] **Step 5: Run focused UI tests**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: PASS

### Task 3: Thread clarification payload through the Side Panel state

**Files:**
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`

- [x] **Step 1: Track clarification payload in side panel state**

```ts
const [clarification, setClarification] = useState<ClarificationPayload | null>(null);
```

- [x] **Step 2: Populate clarification on parsed intent events**

```ts
if (event.type === "intent.parse.succeeded") {
  setIntent(event.payload.intent);
  setClarification(event.payload.intent.metadata.clarification ?? null);
}
```

- [x] **Step 3: Clear clarification on new requests**

```ts
function resetTransientState(nextRequestId: string) {
  setClarification(null);
}
```

- [x] **Step 4: Pass clarification into ActionCard**

```tsx
<ActionCard clarification={state.clarification} ... />
```

- [x] **Step 5: Update the side panel state surface if needed**

Show clarification kind or summary only if it improves readability without adding clutter.

### Task 4: Verify workflow behavior remains unchanged

**Files:**
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Add a regression test that clarification payload does not alter routing**

```ts
it("still returns to idle when clarification payload is present", async () => {
  // parser stub returns needsClarification true plus clarification payload
});
```

- [x] **Step 2: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 5: Verify the full slice and write back execution status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-clarification-payload-ui-consumption.md`

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
- clarification payload UI rendering
- state threading
- workflow behavior unchanged
- verification commands run
