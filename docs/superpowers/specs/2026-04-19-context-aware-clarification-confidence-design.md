# Context-Aware Clarification And Confidence Design

## Goal

Define how SIP should use browser context to influence parser confidence and clarification behavior without letting page hints silently turn ambiguous requests into overconfident executable intents.

## Why This Slice

SIP now passes real page context into the OpenAI parser:

- page URL
- page title
- selected text
- raw hints
- detected token hints

That improves the parser's available evidence, but it also creates a new risk: the model may over-trust partial page hints and produce an intent that looks more certain than it should.

The current code and docs already define the downstream meaning of:

- `confidence`
- `needsClarification`
- `sourceContext`

What is still missing is the parser-side decision policy that explains how context should influence those fields.

## Scope

In scope:

- Define confidence behavior when page context is present
- Define clarification rules for ambiguous requests with partial context
- Define how `metadata.sourceContext` should be populated
- Define parser-side rules for when context can support an interpretation vs. when it should only lower ambiguity slightly
- Add deterministic tests for these rules at the parser boundary

Out of scope:

- Changing `SIPIntent` schema
- Modifying workflow-state transitions
- Changing risk policy thresholds
- Adding new page-detection heuristics
- Prompt-quality optimization beyond this decision policy
- UI redesign

## Existing Constraints

This slice must remain consistent with current documentation:

- `confidence >= 0.85` can continue toward risk scan
- `0.5 <= confidence < 0.85` should be treated as low-confidence / warning territory
- `confidence < 0.5` should not directly execute
- `needsClarification = true` routes back to `idle` instead of `failed`
- page context is advisory, not authoritative

## Recommended Approach

### Option 1: Let the model decide clarification and confidence freely from prompt instructions

Pros:

- Minimal code

Cons:

- Hard to test
- Behavior may drift over time
- Leaves too much policy in prompt interpretation

### Option 2: Keep model output but add a parser-side normalization layer

Pros:

- More deterministic
- Easy to test
- Keeps prompt useful while preventing overconfident output

Cons:

- Slightly more logic after parsing

### Option 3: Hard-code confidence from context heuristics and mostly ignore model confidence

Pros:

- Predictable

Cons:

- Too rigid
- Loses useful model judgment
- Over-corrects toward heuristic parsing

Recommendation: Option 2.

## Design

### 1. Confidence remains model-led but parser-normalized

The model should still return the raw `confidence`, but the parser boundary should normalize it using a few explicit rules.

Recommended principle:

- context can support interpretation
- context cannot fully replace missing intent specificity

That means:

- if the user request is specific and context agrees, confidence can remain high
- if the user request is vague and context is only suggestive, confidence should be capped downward

### 2. Clarification depends on both user ambiguity and context strength

The parser should treat ambiguity in three buckets:

#### A. Explicit enough request

Examples:

- `swap 1 SOL to USDC`
- `buy 1 SOL of BONK`

Expected behavior:

- `needsClarification = false`
- confidence can remain high if context does not conflict

#### B. Page-assisted but still ambiguous request

Examples:

- `buy this`
- `ape in`
- `swap into this token`

If the page provides one plausible token hint, the parser may infer a candidate target, but it should remain conservative.

Expected behavior:

- if context is strong and singular, parser may fill a candidate target
- confidence should usually be capped below the direct-execution threshold unless the target is extremely clear
- `needsClarification` should remain available when multiple plausible targets exist or the selected text is not specific enough

#### C. Under-specified request even with context

Examples:

- `do it`
- `go`
- `buy`

Expected behavior:

- `needsClarification = true`
- confidence should be low
- parser should not pretend that page hints alone are enough

### 3. Context strength should be modeled explicitly

The parser-side normalization should reason about context strength at a coarse level:

- `strong`
  - selected text includes a token symbol or contract
  - exactly one high-confidence detected token
- `medium`
  - several hints agree, but not enough for certainty
- `weak`
  - only generic hints or noisy text are available

Context strength should not become a runtime contract field yet. It is an internal parser concern.

### 4. Confidence caps

Recommended normalization rules:

- if `needsClarification = true`, confidence should be capped below `0.5`
- if request is context-dependent and context strength is only `medium`, confidence should be capped below `0.85`
- if multiple token candidates exist, confidence should be capped and clarification should usually be required
- if context is absent, parser should behave no more confidently than it would have before

This prevents the model from returning a formally valid but operationally overconfident result.

### 5. `sourceContext` should be deterministic

The parser should populate `metadata.sourceContext` from real evidence categories rather than ad-hoc prose.

Recommended values:

- `page-url`
- `page-title`
- `selected-text`
- `raw-hints`
- `detected-token`
- `user-input`

Rules:

- always include `user-input`
- include a page source only if it actually contributed evidence
- keep values stable and low-cardinality

### 6. Parser-side normalization should be post-schema

The normalization layer should run after JSON parsing, not inside the schema.

Suggested sequence:

1. model returns valid JSON
2. parser converts JSON to `SIPIntent`
3. parser computes context strength and ambiguity
4. parser normalizes:
   - `confidence`
   - `needsClarification`
   - `sourceContext`

This keeps schema enforcement and policy enforcement separate.

## Testing Strategy

Add parser-focused tests for cases like:

- specific user request + strong context -> high confidence, no clarification
- vague `buy this` + single strong token hint -> candidate target allowed, but confidence capped conservatively
- vague `buy this` + multiple token hints -> clarification required
- extremely underspecified request -> clarification required even with page context
- `sourceContext` contains deterministic categories

These tests should focus on normalization behavior, not on full model evaluation.

## Files

- Modify: `extension/src/background/openai-intent-parser.ts`
- Modify: `extension/src/background/intent-parser.ts`
- Create or expand tests:
  - `extension/tests/background/openai-intent-parser.test.ts`

## Risks

- Over-normalization can make the parser too timid and reduce usefulness
- Under-normalization can let context create false certainty
- If `sourceContext` becomes too granular, it will be noisy for UI and tests

## Success Criteria

- Parser confidence is context-aware but conservatively normalized
- Ambiguous requests with weak or conflicting context set `needsClarification = true`
- `sourceContext` is stable and deterministic
- Existing workflow semantics remain unchanged
- Tests cover the new normalization rules
