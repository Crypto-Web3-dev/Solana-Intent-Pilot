# Context-Driven Mint Resolution Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parser-side mint-resolution guardrails so page hints can support parsing without silently turning weak token guesses into executable `outputMint` decisions.

**Architecture:** Keep the OpenAI parser as the source of raw structured output, then add a small mint-evidence normalization layer inside `openai-intent-parser.ts`. The new layer should compose with the existing confidence and clarification normalization instead of creating a separate workflow path.

**Tech Stack:** TypeScript, OpenAI Responses API, Vitest

## Execution Status

Completed on `2026-04-19`.

- Parser-side mint guardrails are now implemented in `extension/src/background/openai-intent-parser.ts`.
- Weak page hints can no longer silently justify a high-confidence `outputMint` decision for context-dependent requests.
- New parser tests cover strong single-token evidence, medium context-dependent evidence, multiple-candidate ambiguity, and weak-hints-only clarification.
- Workflow regression coverage confirms mint-driven clarification still short-circuits to `idle` with `clarification-required`, without running risk or preview work.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Add failing parser tests for mint guardrails

**Files:**
- Modify: `extension/tests/background/openai-intent-parser.test.ts`

- [x] **Step 1: Add the strong single-token happy-path test**

```ts
it("keeps a resolved outputMint when explicit intent matches strong single-token context", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.94,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    strongMintContext,
    "buy 1 SOL of BONK"
  );

  expect(normalized.payload.outputMint).toBe(validIntent.payload.outputMint);
  expect(normalized.metadata.needsClarification).toBe(false);
});
```

- [x] **Step 2: Add the medium-strength context-dependent test**

```ts
it("keeps a candidate outputMint but caps confidence for context-dependent medium evidence", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.93,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    mediumMintContext,
    "buy this"
  );

  expect(normalized.payload.outputMint).toBe(validIntent.payload.outputMint);
  expect(normalized.confidence).toBeLessThan(0.85);
});
```

- [x] **Step 3: Add the multiple-candidate ambiguity test**

```ts
it("requires clarification when multiple token candidates could justify outputMint", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.9,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    multiTokenContext,
    "buy this"
  );

  expect(normalized.metadata.needsClarification).toBe(true);
  expect(normalized.confidence).toBeLessThan(0.5);
});
```

- [x] **Step 4: Add the weak-hints-only test**

```ts
it("requires clarification when outputMint is supported only by weak page hints", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.89,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    weakMintContext,
    "buy this"
  );

  expect(normalized.metadata.needsClarification).toBe(true);
  expect(normalized.confidence).toBeLessThan(0.5);
});
```

- [x] **Step 5: Run focused parser tests to verify they fail**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: FAIL because mint guardrail behavior is not implemented yet

### Task 2: Add mint-evidence helpers

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Add a mint-evidence strength helper**

```ts
type MintEvidenceStrength = "weak" | "medium" | "strong";

function getMintEvidenceStrength(context?: DetectedContextSnapshot) {
  if (!context) {
    return "weak" as const;
  }

  const hasSelectedText = Boolean(context.selectedText?.trim());
  const singleToken = context.detectedTokens.length === 1;

  if (hasSelectedText && singleToken) {
    return "strong" as const;
  }

  if (singleToken || context.rawHints.length > 0) {
    return "medium" as const;
  }

  return "weak" as const;
}
```

- [x] **Step 2: Add a helper for token-candidate ambiguity**

```ts
function hasMultipleTokenCandidates(context?: DetectedContextSnapshot) {
  return (context?.detectedTokens.length ?? 0) > 1;
}
```

- [x] **Step 3: Add a helper for weak mint provenance**

```ts
function hasOnlyWeakMintProvenance(
  context?: DetectedContextSnapshot,
  userInput = ""
) {
  if (!context) {
    return true;
  }

  const explicitTokenMention = /[A-Za-z0-9]{3,}|\$[A-Za-z0-9]+/.test(userInput);
  const hasSelectedText = Boolean(context.selectedText?.trim());
  const hasDetectedToken = context.detectedTokens.length > 0;

  return !explicitTokenMention && !hasSelectedText && !hasDetectedToken;
}
```

### Task 3: Implement mint guardrail normalization

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Extend `normalizeIntentWithContext()` with mint guardrails**

```ts
const mintEvidenceStrength = getMintEvidenceStrength(context);
const multipleTokenCandidates = hasMultipleTokenCandidates(context);
const weakMintProvenance = hasOnlyWeakMintProvenance(context, userInput);

const mintNeedsClarification =
  multipleTokenCandidates ||
  (isContextDependentRequest(userInput) && mintEvidenceStrength === "weak") ||
  weakMintProvenance;
```

- [x] **Step 2: Merge mint clarification with existing clarification rules**

```ts
const needsClarification =
  intent.metadata.needsClarification ||
  isUnderspecifiedRequest(userInput) ||
  mintNeedsClarification;
```

- [x] **Step 3: Preserve candidate mints but cap confidence conservatively**

```ts
if (needsClarification) {
  confidence = Math.min(confidence, 0.49);
} else if (
  isContextDependentRequest(userInput) &&
  mintEvidenceStrength !== "strong"
) {
  confidence = Math.min(confidence, 0.84);
}
```

- [x] **Step 4: Run focused parser tests**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: PASS

### Task 4: Verify workflow integration remains unchanged

**Files:**
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Add a regression test for mint-driven clarification**

```ts
it("still short-circuits to clarification when mint guardrails reject weak page evidence", async () => {
  // Inject a parser stub that returns needsClarification true after mint normalization.
});
```

- [x] **Step 2: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 5: Verify the full slice and write back execution status

**Files:**
- Modify: `docs/superpowers\\plans\\2026-04-19-context-driven-mint-resolution-guardrails.md`

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

Add an `Execution Status` section at the top of this plan summarizing:

- completed date
- parser guardrails implemented
- tests added
- workflow behavior preserved
- final verification commands run
