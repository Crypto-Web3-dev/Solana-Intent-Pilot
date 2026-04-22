# Context-Aware OpenAI Intent Parsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feed real page context into the OpenAI intent parser while preserving the existing JSON schema, fallback behavior, and overall workflow architecture.

**Architecture:** Extend the parser boundary so `parseIntent` accepts optional `DetectedContextSnapshot`, build a deterministic structured context summary for the OpenAI request, and keep the default parser fallback path unchanged.

**Tech Stack:** TypeScript, OpenAI Responses API, Vitest

---

## Execution Status

This plan has been implemented in the current workspace.

Implemented areas:

- `parseIntent(userInput, context?)` now accepts optional `DetectedContextSnapshot`
- the OpenAI parser builds a deterministic structured page-context block
- the Responses API request now includes:
  - user request
  - page context
- the parser still works without context
- the default parser still falls back to the mock parser on OpenAI failure
- `message-router` now passes `contextSnapshot` into the parser boundary

Verification status:

- `pnpm -C extension exec tsc --noEmit --pretty false` passes
- `pnpm -C extension test` passes
- `pnpm -C extension build` passes

Notes:

- During one focused rerun of `workflow-engine.test.ts`, the existing preview-failure test flaked once, but the full suite passed immediately afterward with no code changes. Treat that as a residual test-stability risk rather than a confirmed regression in this slice.

---

### Task 1: Add failing tests for context-aware OpenAI request construction

**Files:**
- Create: `extension/tests/background/openai-intent-parser.test.ts`
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Write the failing test for structured context injection**

```ts
it("includes structured page context in the OpenAI request", async () => {
  const responsesCreate = vi.fn().mockResolvedValue({
    output_text: JSON.stringify(validIntent)
  });

  const parser = createOpenAIIntentParser({
    client: { responses: { create: responsesCreate } } as never,
    apiKey: "test-key"
  });

  await parser.parseIntent("buy 1 SOL of this", contextSnapshot);

  expect(responsesCreate).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(responsesCreate.mock.calls[0][0].input)).toContain("x.com");
  expect(JSON.stringify(responsesCreate.mock.calls[0][0].input)).toContain("BONK");
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: FAIL because the parser does not accept injected client/context yet

- [x] **Step 3: Add the no-context compatibility test**

```ts
it("still works when no context snapshot is provided", async () => {
  const responsesCreate = vi.fn().mockResolvedValue({
    output_text: JSON.stringify(validIntent)
  });

  const parser = createOpenAIIntentParser({
    client: { responses: { create: responsesCreate } } as never,
    apiKey: "test-key"
  });

  const result = await parser.parseIntent("buy 1 SOL of this");

  expect(result.intent).toBe("SWAP");
});
```

- [x] **Step 4: Add the deterministic formatter test**

```ts
it("formats context into a stable summary block", () => {
  const summary = formatContextForPrompt(contextSnapshot);

  expect(summary).toContain("Page URL:");
  expect(summary).toContain("Selected Text:");
  expect(summary).toContain("Detected Tokens:");
});
```

- [x] **Step 5: Run the focused tests again**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: FAIL only because implementation is missing

### Task 2: Implement parser-side context formatting

**Files:**
- Modify: `extension/src/background/openai-intent-parser.ts`

- [x] **Step 1: Add the optional parser dependencies**

```ts
export function createOpenAIIntentParser(options?: {
  client?: OpenAI;
  apiKey?: string;
  model?: string;
}) {
  const env = (globalThis as typeof globalThis & {
    process?: { env: Record<string, string | undefined> };
  }).process?.env;
  const apiKey = options?.apiKey ?? env?.OPENAI_API_KEY;
  const model = options?.model ?? env?.OPENAI_MODEL ?? "gpt-5.4-mini";
  const client = options?.client ?? (apiKey ? createClient(apiKey) : null);
```

- [x] **Step 2: Add the context formatter**

```ts
export function formatContextForPrompt(context?: DetectedContextSnapshot) {
  if (!context) {
    return "No page context was available.";
  }

  const detectedTokens = context.detectedTokens.length
    ? context.detectedTokens
        .map((token) => {
          const tokenId = token.mint ?? token.symbol ?? "unknown";
          return `${token.source}:${tokenId}:${token.confidence}`;
        })
        .join(", ")
    : "none";

  const rawHints = context.rawHints.length ? context.rawHints.join(", ") : "none";

  return [
    `Page URL: ${context.url}`,
    `Page Title: ${context.title}`,
    `Selected Text: ${context.selectedText ?? "none"}`,
    `Raw Hints: ${rawHints}`,
    `Detected Tokens: ${detectedTokens}`
  ].join("\\n");
}
```

- [x] **Step 3: Update the parser method signature**

```ts
async parseIntent(
  userInput: string,
  context?: DetectedContextSnapshot
): Promise<SIPIntent> {
```

- [x] **Step 4: Add the structured context input block**

```ts
input: [
  {
    role: "system",
    content:
      "You convert user trading requests into a valid SIPIntent JSON object. Use page context as supporting evidence only. Do not invent missing fields. Return only valid JSON that matches the schema."
  },
  {
    role: "user",
    content: `User request:\\n${userInput}`
  },
  {
    role: "user",
    content: `Page context:\\n${formatContextForPrompt(context)}`
  }
],
```

- [x] **Step 5: Run the focused parser tests**

Run: `pnpm -C extension test -- openai-intent-parser.test.ts`
Expected: PASS

### Task 3: Propagate optional context through the parser boundary

**Files:**
- Modify: `extension/src/background/intent-parser.ts`
- Modify: `extension/src/background/runtime-services.ts`
- Modify: `extension/src/background/message-router.ts`

- [x] **Step 1: Update the shared parser interface**

```ts
export interface IntentParser {
  parseIntent(
    userInput: string,
    context?: DetectedContextSnapshot
  ): Promise<SIPIntent>;
}
```

- [x] **Step 2: Keep the mock parser compatible**

```ts
export function createMockIntentParser(): IntentParser {
  return {
    parseIntent(userInput: string): Promise<SIPIntent> {
      return mockParseIntent(userInput);
    }
  };
}
```

- [x] **Step 3: Pass context through the default parser**

```ts
async parseIntent(userInput: string, context?: DetectedContextSnapshot) {
  try {
    return await openAIParser.parseIntent(userInput, context);
  } catch {
    return mockParseIntent(userInput);
  }
}
```

- [x] **Step 4: Update runtime services and router calls**

```ts
const { requestId, userInput, contextSnapshot } = message.payload;
intent = await services.parseIntent(userInput, contextSnapshot);
```

- [x] **Step 5: Run focused workflow tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 4: Verify the full slice

**Files:**
- Modify: `docs/superpowers/specs/2026-04-19-context-aware-openai-intent-parsing-design.md`
- Modify: `docs/superpowers/plans/2026-04-19-context-aware-openai-intent-parsing.md`

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

Adjust the spec or plan inline if naming or prompt wording changed during implementation.
