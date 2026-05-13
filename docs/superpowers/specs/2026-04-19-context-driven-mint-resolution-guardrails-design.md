# Context-Driven Mint Resolution Guardrails Design

## Goal

Define how SIP may use page context to support mint resolution without letting browser hints silently become authoritative token selection.

## Why This Slice

SIP now has three layers of parser support:

- real page context reaches the parser
- parser confidence and clarification are normalized after model output
- platform-aware hints can surface likely token candidates

That makes parsing more useful, but it creates a sharper trust-boundary problem: `outputMint` is the most execution-sensitive field in the intent. If the system becomes too eager to fill it from weak hints, we can turn vague requests into executable swaps that look valid but are not actually grounded in user intent.

This slice defines the guardrails for mint resolution so later parser improvements can safely use page context without bypassing clarification.

## Scope

In scope:

- define when page context may strengthen an already-plausible mint candidate
- define when page context must not auto-resolve `outputMint`
- distinguish `missing`, `unknown`, and `ambiguous` mint-resolution situations
- define when mint resolution must force `needsClarification = true`
- define deterministic parser-side guardrails and tests

Out of scope:

- changing `SIPIntent` schema
- adding new workflow phases or workflow reasons
- adding new risk-policy thresholds
- adding broad new page-detection heuristics
- adding live token registries or symbol-to-mint resolution services
- redesigning sidepanel clarification UI

## Existing Constraints

This slice must stay aligned with current docs and code:

- `outputMint` remains required in a valid `SIPIntent`
- low-confidence or unclear requests must route to clarification rather than silently continue
- page context is advisory, not authoritative
- multiple plausible token candidates must not be collapsed into one executable mint without user confirmation
- `needsClarification = true` remains metadata, not a workflow phase

## Problem Framing

There are three different parser states that can all look like "we are not ready to execute," but they mean different things:

### 1. Missing

The parser has no plausible mint candidate at all.

Examples:

- user says `buy`
- page has no useful token hints

Expected behavior:

- parser may return a placeholder or partial candidate internally
- final intent must require clarification
- confidence should stay below direct-execution territory

### 2. Unknown

The parser sees a token-like reference, but cannot safely map it to a unique mint.

Examples:

- page contains only a symbol with no contract
- selected text says `$MOON`, but no reliable single mint candidate exists

Expected behavior:

- parser must not invent a mint
- clarification required
- confidence capped conservatively

### 3. Ambiguous

The parser has more than one plausible candidate.

Examples:

- `buy this` on a page with two detected token candidates
- page title and selected text suggest different symbols

Expected behavior:

- parser must not auto-pick one
- clarification required
- confidence kept below executable range

## Recommended Approach

### Option 1: Let the model decide mint resolution from prompt guidance alone

Pros:

- minimal implementation

Cons:

- brittle and hard to test
- trust-boundary behavior can drift with prompt/model changes

### Option 2: Keep model output but add a parser-side mint guardrail layer

Pros:

- deterministic and testable
- preserves model usefulness while enforcing safe boundaries
- composes naturally with the clarification/confidence normalization already in place

Cons:

- adds one more normalization pass at the parser boundary

### Option 3: Ban all mint help from page context

Pros:

- very safe

Cons:

- throws away a big part of SIP's value
- makes parser quality on real pages much worse

Recommendation: Option 2.

## Design

### 1. Mint resolution should remain user-led, context-assisted

The system may use page context to support a mint candidate only when the user intent already points toward a specific token or the page context is singular and strong enough to behave like a direct reference.

Principle:

- context may strengthen
- context may disambiguate only when the ambiguity is truly narrow
- context may not create authority from generic page noise

### 2. Strong vs weak mint evidence

The parser-side guardrail should reason about mint evidence coarsely:

#### Strong mint evidence

Examples:

- selected text contains a contract address
- exactly one detected token exists and selected text references `this token`
- user explicitly names one token and page context agrees

Allowed behavior:

- parser may keep the resolved `outputMint`
- clarification may remain `false` if the rest of the request is also clear

#### Medium mint evidence

Examples:

- one detected token exists, but selected text is generic
- page title hints at a token, but there is no contract or explicit user token mention

Allowed behavior:

- parser may keep a candidate mint for previewing logic
- parser should usually cap confidence
- clarification should remain available if user wording is vague

#### Weak mint evidence

Examples:

- only generic raw hints
- symbol-like text with no stable candidate
- multiple low-confidence detected tokens

Allowed behavior:

- parser must not treat this as resolved execution intent
- clarification required

### 3. Guardrail rules for `outputMint`

The parser-side normalization should apply these rules after schema parsing:

- if there is no plausible mint evidence, require clarification
- if there are multiple plausible token candidates, require clarification
- if the user request is context-dependent and mint evidence is weaker than strong, prefer clarification
- if the resolved mint comes only from weak generic hints, require clarification
- if the parser keeps a mint candidate despite medium-strength evidence, confidence must stay below direct-execution territory

This means a syntactically valid `outputMint` is not enough on its own. The guardrail must also consider how that mint was justified.

### 4. `sourceContext` should expose mint evidence provenance

This slice should not add new runtime fields, but it should make source provenance more meaningful.

The existing deterministic `sourceContext` categories remain valid:

- `user-input`
- `page-url`
- `page-title`
- `selected-text`
- `raw-hints`
- `detected-token`

Mint-related interpretation should rely primarily on:

- `user-input`
- `selected-text`
- `detected-token`

If a resolved mint is supported only by `page-title` or `raw-hints`, that should be treated as weak evidence.

### 5. Parser-side mint guardrails should compose with existing clarification logic

The mint-resolution layer should not replace the confidence/clarification normalization already implemented. Instead, it should compose with it:

1. model returns valid `SIPIntent`
2. parser builds source provenance and ambiguity signals
3. parser applies mint-resolution guardrails
4. parser applies or preserves clarification and confidence caps

Practical outcome:

- mint ambiguity can force `needsClarification = true`
- mint ambiguity can cap confidence even when the model returned high confidence
- workflow behavior remains unchanged downstream

## Testing Strategy

Add parser-focused tests that cover:

- explicit token request + strong single token evidence -> mint may remain resolved
- `buy this` + one medium-strength token candidate -> candidate may remain, but confidence capped conservatively
- `buy this` + two detected token candidates -> clarification required
- generic request + only raw hints/title support -> clarification required
- symbol-like but unresolved token reference -> clarification required

Tests should live at the parser boundary and assert deterministic outcomes from normalization, not end-to-end model quality.

## Files

- Modify: `extension/src/background/openai-intent-parser.ts`
- Modify: `extension/tests/background/openai-intent-parser.test.ts`
- Possibly modify: `extension/tests/background/workflow-engine.test.ts`

## Risks

- Guardrails that are too strict can make SIP feel timid on real pages
- Guardrails that are too loose can silently over-resolve `outputMint`
- Symbol-only page hints are especially risky because they can look specific while still being non-unique
