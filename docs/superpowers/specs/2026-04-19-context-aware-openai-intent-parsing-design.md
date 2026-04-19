# Context-Aware OpenAI Intent Parsing Design

## Goal

Upgrade the OpenAI intent parsing path so the model receives real page context alongside the user's natural-language request, while preserving strict JSON output, schema safety, and the current fallback behavior.

## Why This Slice

The execution path now has much richer browser context than the parser currently uses:

- real page URL
- real page title
- selected text
- lightweight raw hints
- platform-aware detected token hints

But the OpenAI parser still only sees `userInput`.

That means SIP is already doing the work to collect context, but the model that decides the intent cannot actually use it. This is the highest-value next step for improving real-world parse quality without changing the execution architecture.

## Scope

In scope:

- Pass `DetectedContextSnapshot` into the OpenAI parsing boundary
- Include a structured summary of page context in the model input
- Keep the current JSON schema response contract unchanged
- Preserve mock fallback when OpenAI is unavailable or fails
- Add tests that verify context is included and optional

Out of scope:

- Changing `SIPIntent` shape
- Adding new context fields to runtime contracts
- Prompt optimization for every edge case
- New page-detection heuristics beyond the existing context snapshot
- Wasm risk work
- Quote, simulation, or wallet changes

## Recommended Approach

### Option 1: Concatenate raw page context into the user prompt as plain text

Pros:

- Simple to implement

Cons:

- Harder to test
- Easier for prompt shape to drift
- Blurs user request with browser context

### Option 2: Send a structured context block alongside the user request

Pros:

- Cleaner separation of user intent vs. browser evidence
- Easier to test and reason about
- Better aligned with strict schema parsing

Cons:

- Slightly more formatting code

### Option 3: Wait and redesign the whole parser prompt system later

Pros:

- Could produce a more globally optimized parser

Cons:

- Delays obvious wins from context-aware parsing
- Unnecessarily broad for the current need

Recommendation: Option 2.

## Design

### 1. Parser interface takes optional context

The parsing boundary should evolve from:

- `parseIntent(userInput: string): Promise<SIPIntent>`

to:

- `parseIntent(userInput: string, context?: DetectedContextSnapshot): Promise<SIPIntent>`

This keeps context optional so:

- tests remain easy to write
- fallback paths stay simple
- non-contextual calls still work

The default parser and mock parser should both accept the same signature.

### 2. OpenAI receives a structured context summary

The OpenAI parser should build a context summary from the existing `DetectedContextSnapshot`.

Recommended structure:

- page URL
- page title
- selected text if present
- raw hints
- detected token hints

This summary should be sent as a distinct input block, not merged into the user message text. The purpose is to make the model's evidence explicit and stable.

### 3. Context is advisory, not authoritative

The prompt must explicitly say:

- use context as helpful evidence
- do not invent missing fields just because the page suggests a token
- if context is ambiguous, lower confidence or set `needsClarification`
- output must still match the schema exactly

This preserves current safety expectations from the docs:

- low-confidence parses should not silently turn into executable certainty
- missing or ambiguous token targets should remain ambiguous

### 4. Response schema stays unchanged

This slice should not change the `SIPIntent` schema or the JSON schema used with the Responses API.

The output remains:

- `intent`
- `confidence`
- `payload`
- `metadata`

Only the model inputs change.

### 5. Fallback behavior stays intact

The current default parser behavior should remain:

- try OpenAI first
- on failure, use mock parser

This slice must not make local development dependent on a working OpenAI key or network call.

## Testing Strategy

Add parser tests that verify:

- the OpenAI parser can receive context and include it in the request payload
- the parser still works without context
- the default parser still falls back to mock on OpenAI failure
- the context formatter is stable and deterministic

These tests should focus on the parser boundary and prompt construction, not on model quality judgments.

## Files

- Modify: `extension/src/background/openai-intent-parser.ts`
- Modify: `extension/src/background/intent-parser.ts`
- Modify: `extension/src/background/runtime-services.ts`
- Modify: `extension/src/background/message-router.ts`
- Create or expand tests:
  - `extension/tests/background/openai-intent-parser.test.ts`
  - `extension/tests/background/workflow-engine.test.ts`

## Risks

- Too much raw context can add noise if formatting is sloppy
- The model may over-trust page hints unless the system instruction is explicit
- Changing the parser signature can create small ripple effects across adapters if not done carefully

## Success Criteria

- OpenAI parser receives structured page context when available
- Parser still works without context
- Schema and runtime contracts remain unchanged
- Default parser keeps mock fallback behavior
- Tests cover context-aware request construction and fallback behavior
