# Context-Driven Clarification Payloads Design

## Goal

Define the minimum structured clarification payload SIP should produce when parser guardrails decide an intent needs clarification, so UI and follow-up flows can explain what is missing without changing the core workflow model.

## Why This Slice

SIP now has parser-side guardrails for:

- context-aware confidence normalization
- mint-resolution ambiguity
- clarification routing when page evidence is too weak

That is enough to safely stop risky execution, but it still leaves an important gap: downstream consumers only get `needsClarification = true`, which is not enough to explain why clarification is needed or what the user should clarify next.

Right now the UI can tell the user that clarification is required, but it cannot reliably distinguish:

- no token candidate found
- token-like reference exists but cannot be resolved safely
- multiple token candidates exist
- request is too underspecified even with page context

This slice defines a minimal, structured clarification payload so SIP can stay safe without degrading into vague UI.

## Scope

In scope:

- define the minimal clarification payload shape
- define clarification categories for parser-originated ambiguity
- define how the payload composes with `SIPIntent.metadata.needsClarification`
- define how UI may consume the payload without owning workflow transitions
- define parser-boundary tests for clarification payload generation

Out of scope:

- redesigning Side Panel clarification UI
- changing workflow phases or workflow reasons
- changing risk policy
- adding full conversational multi-turn clarification flows
- introducing token-registry lookups or new external services

## Existing Constraints

This slice must remain aligned with current docs:

- `needsClarification` remains the workflow-routing switch
- `needsClarification` is metadata, not a workflow phase
- `clarification-required` remains the workflow reason
- `Background` remains the only workflow orchestrator
- `Side Panel` may render clarification context but must not invent its own interpretation rules

## Recommended Approach

### Option 1: Keep only `needsClarification: boolean` and derive reasons in the UI

Pros:

- no contract changes

Cons:

- UI would have to infer parser intent from incomplete state
- behavior becomes duplicated and brittle

### Option 2: Add a small clarification payload inside intent metadata

Pros:

- deterministic and testable
- keeps explanation close to parser decisions
- gives UI stable semantics without changing the workflow model

Cons:

- small runtime-contract expansion

### Option 3: Add a separate clarification message/event outside `SIPIntent`

Pros:

- decouples clarification from parser schema

Cons:

- heavier integration
- duplicates information the parser already knows at parse time

Recommendation: Option 2.

## Design

### 1. Clarification stays in metadata, not workflow state

This slice should preserve the existing routing model:

- parser returns `SIPIntent`
- `metadata.needsClarification = true` causes the workflow to return to `idle`
- `clarification-required` remains the workflow reason

The new addition is explanatory, not behavioral.

### 2. Add a minimal `clarification` object to intent metadata

Recommended shape:

```ts
type ClarificationKind =
  | "missing-output-mint"
  | "unknown-output-mint"
  | "ambiguous-output-mint"
  | "underspecified-request";

interface ClarificationPayload {
  kind: ClarificationKind;
  message: string;
  candidateSymbols?: string[];
}
```

Recommended placement:

```ts
metadata: {
  reasoning: string;
  requiresRiskScan: boolean;
  sourceContext: string[];
  needsClarification: boolean;
  clarification?: ClarificationPayload;
}
```

This keeps the payload:

- serializable
- small
- parser-owned
- UI-readable without extra interpretation layers

### 3. Clarification kinds

#### `missing-output-mint`

Use when:

- parser has no plausible token candidate
- page context is effectively empty or irrelevant

Example:

- user says `buy`
- page has no detected tokens and no useful selected text

#### `unknown-output-mint`

Use when:

- parser sees token-like context but cannot safely resolve a unique candidate
- evidence is suggestive but not enough to keep a single candidate

Example:

- page has raw hints like `moon`
- no stable token candidate exists

#### `ambiguous-output-mint`

Use when:

- more than one plausible token candidate exists

Example:

- page has both `BONK` and `WIF`
- request says `buy this`

`candidateSymbols` may be included here when a short, stable list is available.

#### `underspecified-request`

Use when:

- the request is too vague even if page context exists

Example:

- `do it`
- `go`
- `buy`

This is broader than mint resolution and should remain available as a general parser clarification category.

### 4. Clarification payloads should be deterministic

The parser-side normalization should fill `clarification` using deterministic rules, not free-form prose from the model.

Rules:

- `kind` must come from a stable enum-like union
- `message` may be brief user-facing guidance, but should be produced from deterministic templates
- `candidateSymbols` should only be included for short, stable candidate lists

This keeps tests stable and prevents explanation drift across model changes.

### 5. Clarification payloads should not change downstream execution rules

This slice should not introduce a new workflow branch.

Downstream meaning stays:

- `needsClarification = true` -> do not continue execution
- `clarification` explains why

UI may render:

- a targeted message
- candidate chips
- a more precise follow-up prompt

But the workflow remains unchanged.

## Testing Strategy

Add parser-boundary tests that cover:

- no candidate mint -> `missing-output-mint`
- weak hint only -> `unknown-output-mint`
- multiple token candidates -> `ambiguous-output-mint`
- generic command like `buy` -> `underspecified-request`
- candidate symbols included only for ambiguous multi-token cases

If runtime contracts change, add one shared-contract test to keep the metadata shape stable.

## Files

- Modify: `extension/src/shared/intent.ts`
- Modify: `extension/src/background/openai-intent-parser.ts`
- Modify: `extension/tests/background/openai-intent-parser.test.ts`
- Possibly modify: `extension/tests/shared/contracts.test.ts`

## Risks

- payload shape that is too broad will become a second parser protocol
- payload shape that is too small will not help UI enough
- free-form explanation text would reintroduce drift even if the enum is stable
