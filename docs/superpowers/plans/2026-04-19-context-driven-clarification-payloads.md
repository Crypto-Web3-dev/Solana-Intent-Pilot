# Context-Driven Clarification Payloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small structured clarification payload to parser output so SIP can explain why clarification is required without changing the workflow model.

**Architecture:** Expand `SIPIntent.metadata` with an optional `clarification` object, then generate that payload inside parser-side normalization. The existing `needsClarification` routing remains authoritative; the new payload is explanatory and UI-facing.

**Tech Stack:** TypeScript, React, Vitest

## Execution Status

Completed on `2026-04-19`.

- `SIPIntent.metadata` now includes optional clarification payloads in `extension/src/shared/intent.ts`.
- Parser-side normalization now emits deterministic clarification payloads for `missing-output-mint`, `unknown-output-mint`, `ambiguous-output-mint`, and `underspecified-request`.
- Parser tests now cover all four clarification payload cases.
- Workflow routing remains unchanged: clarification still short-circuits to `idle` with `clarification-required`.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Extend the runtime contract with clarification payloads

**Files:**
- Modify: `extension/src/shared/intent.ts`
- Modify: `extension/tests/shared/contracts.test.ts`

- [ ] **Step 1: Add the clarification payload types to `intent.ts`**

```ts
export type ClarificationKind =
  | "missing-output-mint"
  | "unknown-output-mint"
  | "ambiguous-output-mint"
  | "underspecified-request";

export interface ClarificationPayload {
  kind: ClarificationKind;
  message: string;
  candidateSymbols?: string[];
}
```

- [ ] **Step 2: Extend `SIPIntent.metadata`**

```ts
metadata: {
  reasoning: string;
  requiresRiskScan: boolean;
  sourceContext: string[];
  needsClarification: boolean;
  clarification?: ClarificationPayload;
}
```

- [ ] **Step 3: Add a shared-contract test**

```ts
it("allows optional clarification metadata on SIPIntent", () => {
  const intent: SIPIntent = {
    ...validIntent,
    metadata: {
      ...validIntent.metadata,
      needsClarification: true,
      clarification: {
        kind: "ambiguous-output-mint",
        message: "Multiple token candidates were detected.",
        candidateSymbols: ["BONK", "WIF"]
      }
    }
  };

  expect(intent.metadata.clarification?.kind).toBe("ambiguous-output-mint");
});
```

- [ ] **Step 4: Run shared-contract tests**

Run: `pnpm -C extension test -- contracts.test.ts`
Expected: PASS

### Task 2: Add failing parser tests for clarification payloads

**Files:**
- Modify: `extension/tests/background/openai-intent-parser.test.ts`

- [ ] **Step 1: Add the missing-output-mint test**

```ts
it("produces missing-output-mint clarification when no candidate exists", () => {
  // expect clarification.kind === "missing-output-mint"
});
```

- [ ] **Step 2: Add the unknown-output-mint test**

```ts
it("produces unknown-output-mint clarification for weak unresolved hints", () => {
  // expect clarification.kind === "unknown-output-mint"
});
```

- [ ] **Step 3: Add the ambiguous-output-mint test**

```ts
it("produces ambiguous-output-mint clarification with candidate symbols", () => {
  // expect clarification.kind === "ambiguous-output-mint"
  // expect candidateSymbols to include detected token symbols
});
```

- [ ] **Step 4: Add the underspecified-request test**

```ts
it("produces underspecified-request clarification for generic commands", () => {
  // expect clarification.kind === "underspecified-request"
});
```

- [ ] **Step 5: Run focused parser tests to verify they fail**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: FAIL because clarification payload generation does not exist yet

### Task 3: Implement parser-side clarification payload generation

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [ ] **Step 1: Add deterministic message builders**

```ts
function buildClarificationMessage(kind: ClarificationKind) {
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

- [ ] **Step 2: Add a clarification payload helper**

```ts
function buildClarificationPayload(
  context: DetectedContextSnapshot | undefined,
  userInput: string
): ClarificationPayload | undefined {
  // deterministic mint/request classification logic
}
```

- [ ] **Step 3: Attach clarification payload inside normalization**

```ts
const clarification =
  needsClarification ? buildClarificationPayload(context, userInput) : undefined;
```

- [ ] **Step 4: Return metadata with both `needsClarification` and `clarification`**

```ts
metadata: {
  ...intent.metadata,
  needsClarification,
  clarification,
  sourceContext: buildSourceContext(context)
}
```

- [ ] **Step 5: Run focused parser tests**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: PASS

### Task 4: Verify integration safety

**Files:**
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [ ] **Step 1: Add a regression assertion that clarification payload does not change routing**

```ts
it("still returns to idle when clarification payload is present", async () => {
  // parser stub returns needsClarification true plus clarification payload
});
```

- [ ] **Step 2: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 5: Verify the full slice and write back execution status

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-context-driven-clarification-payloads.md`

- [ ] **Step 1: Run type-check**

Run: `pnpm -C extension exec tsc --noEmit --pretty false`
Expected: PASS

- [ ] **Step 2: Run full extension tests**

Run: `pnpm -C extension test`
Expected: PASS

- [ ] **Step 3: Run production build**

Run: `pnpm -C extension build`
Expected: PASS

- [ ] **Step 4: Write execution status back into the plan**

Add an `Execution Status` section summarizing:

- completed date
- contract expansion
- parser clarification payload generation
- workflow behavior unchanged
- verification commands run
