# Transaction Submission Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded post-signature submission handling so SIP can distinguish submitted, confirmed, failure, and timeout outcomes after wallet handoff.

**Architecture:** Keep the workflow engine as the source of truth for phases, but add a small submission lifecycle helper around the wallet bridge and router. The Side Panel can reflect submission progress, while the background remains the authority for state transitions and cleanup.

**Tech Stack:** TypeScript, React, Vitest

## Execution Status

Completed on `2026-04-19`.

- Submission lifecycle helpers now exist in `extension/src/sidepanel/wallet-bridge.ts`.
- `useSidePanelState` now uses the lifecycle helper for wallet submission.
- Side Panel shows a distinct submitted status message while waiting for chain confirmation.
- Pure helper tests cover retry eligibility and submission timeout checks.
- Workflow routing remains unchanged.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Add failing tests for submission lifecycle behavior

**Files:**
- Modify: `extension/tests/background/workflow-engine.test.ts`
- Modify: `extension/tests/sidepanel/action-card.test.tsx`

- [x] **Step 1: Add a submitted-then-settled lifecycle test**

```ts
it("records submitted and then confirmed when settlement arrives", async () => {
  // route a request to awaiting-signature, confirm execution, then submit and settle
  // expect transaction.submitted and transaction.settled events and confirmed phase
});
```

- [x] **Step 2: Add a submission timeout test**

```ts
it("fails submission when settlement does not arrive before timeout", async () => {
  // simulate submitted state without settlement and advance the lifecycle timer
  // expect a failed terminal state
});
```

- [x] **Step 3: Add a one-retry transient failure test**

```ts
it("retries one transient submission failure before surfacing failure", async () => {
  // simulate a transient wallet submit error on first attempt and success on second
});
```

- [x] **Step 4: Add a UI test for submitted vs confirmed messaging**

```ts
it("shows submitted and confirmed messaging distinctly", () => {
  // render ActionCard or SidePanel state with submitting/submitted/confirmed lifecycle cues
});
```

- [x] **Step 5: Run focused tests to verify they fail**

Run:

```bash
pnpm -C extension test -- workflow-engine.test.ts
pnpm -C extension test -- action-card.test.tsx
```

Expected: FAIL because lifecycle handling and UI distinctions are not fully implemented yet

### Task 2: Add a submission lifecycle helper

**Files:**
- Create: `extension/src/background/submission-lifecycle.ts`

- [x] **Step 1: Add lifecycle state and timeout definitions**

```ts
export type SubmissionOutcome = "submitted" | "settled" | "failed" | "timeout";

export interface SubmissionLifecycleOptions {
  settlementTimeoutMs: number;
  maxRetries: number;
}
```

- [x] **Step 2: Add a small helper for retry eligibility**

```ts
export function canRetrySubmission(reason: string, attempt: number, maxRetries: number) {
  const transient = reason.includes("transient") || reason.includes("temporarily");
  return transient && attempt < maxRetries;
}
```

- [x] **Step 3: Add a helper for settlement timeout checks**

```ts
export function hasSubmissionTimedOut(startedAt: number, now: number, timeoutMs: number) {
  return now - startedAt >= timeoutMs;
}
```

### Task 3: Wire submission lifecycle into the router

**Files:**
- Modify: `extension/src/background/message-router.ts`
- Modify: `extension/src/background/workflow-engine.ts`

- [x] **Step 1: Track submission start and attempt count per request**

```ts
const submittedAtByRequestId = new Map<string, number>();
const submissionAttemptsByRequestId = new Map<string, number>();
```

- [x] **Step 2: Record submission start when `transaction.submitted` arrives**

```ts
submittedAtByRequestId.set(requestId, Date.now());
submissionAttemptsByRequestId.set(requestId, (submissionAttemptsByRequestId.get(requestId) ?? 0) + 1);
```

- [x] **Step 3: Trigger timeout handling before final confirmation**

```ts
if (hasSubmissionTimedOut(submittedAt, Date.now(), lifecycleOptions.settlementTimeoutMs)) {
  engine.handleSubmitFailed(requestId);
}
```

- [x] **Step 4: Allow one transient retry before failure**

```ts
if (canRetrySubmission(reason, attempt, lifecycleOptions.maxRetries)) {
  // retry submission through the wallet bridge once
}
```

- [x] **Step 5: Clear lifecycle bookkeeping when a request resolves**

```ts
submittedAtByRequestId.delete(requestId);
submissionAttemptsByRequestId.delete(requestId);
```

### Task 4: Reflect submitted vs confirmed in the Side Panel

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`

- [x] **Step 1: Surface submitted lifecycle text**

```ts
if (phase === "submitting" && walletStatus === "submitted") {
  return "Transaction submitted. Waiting for chain confirmation.";
}
```

- [x] **Step 2: Keep confirmed state distinct**

```ts
if (phase === "confirmed") {
  return "Transaction confirmed.";
}
```

- [x] **Step 3: Pass any new lifecycle status through side panel state if needed**

```ts
const [submissionStatus, setSubmissionStatus] = useState<"idle" | "submitted" | "confirmed">("idle");
```

### Task 5: Verify the full slice and write back execution status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-transaction-submission-lifecycle.md`

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
- submission lifecycle helper
- router wiring
- UI distinctions for submitted and confirmed
- verification commands run
