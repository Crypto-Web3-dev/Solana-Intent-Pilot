# Context-Aware Clarification And Confidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize parser confidence and clarification behavior so page context improves intent parsing without creating false certainty.

**Architecture:** Keep the OpenAI parser as the source of the raw structured result, then add a parser-side normalization layer that adjusts `confidence`, `needsClarification`, and `sourceContext` based on ambiguity and context strength.

**Tech Stack:** TypeScript, OpenAI Responses API, Vitest

## Execution Status

Completed on `2026-04-19`.

- Parser-side normalization is now implemented in `extension/src/background/openai-intent-parser.ts`.
- OpenAI parser output now flows through `normalizeIntentWithContext(intent, context, userInput)` before entering the runtime pipeline.
- Confidence is capped for clarification and medium-strength context-dependent requests.
- `metadata.sourceContext` is now rebuilt deterministically from `user-input`, `page-url`, `page-title`, `selected-text`, `raw-hints`, and `detected-token`.
- Router-level regression coverage confirms parser-side clarification still short-circuits to `idle` with `clarification-required`, without running risk or preview work.

Verification completed:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

---

### Task 1: Add failing tests for parser normalization behavior

**Files:**
- Modify: `extension/tests/background/openai-intent-parser.test.ts`
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Add the specific-request happy-path test**

```ts
it("keeps high confidence for a specific request with strong context", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.94,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    strongSingleTokenContext
  );

  expect(normalized.confidence).toBe(0.94);
  expect(normalized.metadata.needsClarification).toBe(false);
  expect(normalized.metadata.sourceContext).toContain("user-input");
  expect(normalized.metadata.sourceContext).toContain("detected-token");
});
```

- [x] **Step 2: Add the context-dependent ambiguity test**

```ts
it("caps confidence for context-dependent requests with only medium certainty", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.93,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    ambiguousContext,
    "buy this"
  );

  expect(normalized.confidence).toBeLessThan(0.85);
});
```

- [x] **Step 3: Add the multiple-token clarification test**

```ts
it("requires clarification when multiple token candidates exist", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.88,
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

- [x] **Step 4: Add the underspecified-request test**

```ts
it("requires clarification for extremely underspecified requests", () => {
  const normalized = normalizeIntentWithContext(
    {
      ...validIntent,
      confidence: 0.9,
      metadata: {
        ...validIntent.metadata,
        sourceContext: []
      }
    },
    strongSingleTokenContext,
    "buy"
  );

  expect(normalized.metadata.needsClarification).toBe(true);
  expect(normalized.confidence).toBeLessThan(0.5);
});
```

- [x] **Step 5: Run the focused parser tests to verify they fail**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: FAIL because normalization helpers do not exist yet

### Task 2: Implement context-strength and ambiguity helpers

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Add context-strength helpers**

```ts
type ContextStrength = "weak" | "medium" | "strong";

function getContextStrength(context?: DetectedContextSnapshot): ContextStrength {
  if (!context) {
    return "weak";
  }

  const strongSignals =
    (context.selectedText ? 1 : 0) +
    (context.detectedTokens.length === 1 ? 1 : 0);

  if (strongSignals >= 2) {
    return "strong";
  }

  if (context.detectedTokens.length > 0 || context.rawHints.length > 0) {
    return "medium";
  }

  return "weak";
}
```

- [x] **Step 2: Add request-ambiguity helpers**

```ts
function isUnderspecifiedRequest(userInput: string) {
  const normalized = userInput.trim().toLowerCase();
  return ["buy", "sell", "swap", "do it", "go"].includes(normalized);
}

function isContextDependentRequest(userInput: string) {
  const normalized = userInput.toLowerCase();
  return normalized.includes("this") || normalized.includes("that");
}
```

- [x] **Step 3: Add deterministic source-context extraction**

```ts
function buildSourceContext(context?: DetectedContextSnapshot) {
  const values = ["user-input"];

  if (!context) {
    return values;
  }

  if (context.url) values.push("page-url");
  if (context.title) values.push("page-title");
  if (context.selectedText) values.push("selected-text");
  if (context.rawHints.length) values.push("raw-hints");
  if (context.detectedTokens.length) values.push("detected-token");

  return values;
}
```

### Task 3: Implement parser normalization

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Add `normalizeIntentWithContext()`**

```ts
export function normalizeIntentWithContext(
  intent: SIPIntent,
  context?: DetectedContextSnapshot,
  userInput = ""
): SIPIntent {
  const contextStrength = getContextStrength(context);
  const multipleTokenCandidates = (context?.detectedTokens.length ?? 0) > 1;
  const needsClarification =
    intent.metadata.needsClarification ||
    isUnderspecifiedRequest(userInput) ||
    multipleTokenCandidates;

  let confidence = intent.confidence;

  if (needsClarification) {
    confidence = Math.min(confidence, 0.49);
  } else if (isContextDependentRequest(userInput) && contextStrength !== "strong") {
    confidence = Math.min(confidence, 0.84);
  }

  return {
    ...intent,
    confidence,
    metadata: {
      ...intent.metadata,
      needsClarification,
      sourceContext: buildSourceContext(context)
    }
  };
}
```

- [x] **Step 2: Apply normalization after parsing**

```ts
const parsed = JSON.parse(content) as OpenAIResponseIntent;
const intent: SIPIntent = {
  intent: parsed.intent,
  confidence: parsed.confidence,
  payload: parsed.payload,
  metadata: parsed.metadata
};

return normalizeIntentWithContext(intent, context, userInput);
```

- [x] **Step 3: Run focused parser tests**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: PASS

### Task 4: Verify integration safety

**Files:**
- Modify: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Add a regression assertion for clarification semantics**

```ts
it("still returns to idle when context-aware parsing sets clarification", async () => {
  // use a parser stub that returns needsClarification true after normalization
});
```

- [x] **Step 2: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 5: Verify the full slice

**Files:**
- Modify: `docs/superpowers/specs/2026-04-19-context-aware-clarification-confidence-design.md`
- Modify: `docs/superpowers/plans/2026-04-19-context-aware-clarification-confidence.md`

- [x] **Step 1: Run type-check**

Run: `pnpm -C extension exec tsc --noEmit --pretty false`
Expected: PASS

- [x] **Step 2: Run the full extension test suite**

Run: `pnpm -C extension test`
Expected: PASS

- [x] **Step 3: Run the extension build**

Run: `pnpm -C extension build`
Expected: PASS

- [x] **Step 4: Update docs if implementation differs from the plan**

Adjust the spec or plan inline if names, caps, or source-context labels changed during implementation.
