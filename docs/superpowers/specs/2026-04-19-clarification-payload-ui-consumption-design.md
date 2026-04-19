# Clarification Payload UI Consumption Design

## Goal

Define how SIP should render parser clarification payloads in the Side Panel so users can understand why clarification is required and what kind of ambiguity was detected, without changing workflow behavior.

## Why This Slice

The parser now returns structured clarification payloads for:

- missing output mint
- unknown output mint
- ambiguous output mint
- underspecified request

That is enough to explain parser decisions, but the current Side Panel only reacts to `needsClarification` as a boolean. Users still see a generic clarification message, which loses the detail we just added.

This slice makes the new payload visible in the UI so the workflow can stay safe while the panel becomes more specific and helpful.

## Scope

In scope:

- render clarification payloads in the Side Panel
- distinguish clarification categories visually and textually
- show candidate token symbols when they exist and are stable
- keep workflow routing unchanged
- preserve current blocked / failed / unsupported-page rendering

Out of scope:

- changing workflow phases or workflow reasons
- changing parser normalization logic
- introducing a multi-turn conversation engine
- redesigning the entire panel layout
- adding backend persistence for clarification state

## Existing Constraints

This slice must remain consistent with current behavior:

- `needsClarification` still routes the workflow to `idle`
- `clarification-required` remains the workflow reason
- clarification payloads are advisory, not workflow state
- `blocked`, `failed`, and clarification states must remain visually distinct
- `unknown` must not look like success

## Recommended Approach

### Option 1: Keep the current generic clarification UI

Pros:

- no code changes

Cons:

- throws away the new payload detail
- users still do not know what is missing

### Option 2: Add a dedicated clarification block to the Action Card

Pros:

- smallest useful UI change
- easy to test
- keeps clarification feedback close to the execution CTA

Cons:

- the card gets slightly denser

### Option 3: Create a separate clarification panel section

Pros:

- clearer separation of concerns

Cons:

- more layout work
- more structural churn than this slice needs

Recommendation: Option 2.

## Design

### 1. Clarification should be explicit and category-aware

When `phase === "idle"` and `reason === "clarification-required"`, the Side Panel should not show only a generic "more info needed" message.

It should display:

- the clarification kind
- a short user-facing explanation
- candidate symbols, when available

The category should remain readable and stable, for example:

- `Missing token candidate`
- `Unknown token candidate`
- `Ambiguous token candidate`
- `Request too vague`

### 2. Keep the Action Card as the primary clarification surface

The Action Card is already the execution-oriented area of the panel. It should become the home for clarification messaging because that keeps the user’s next action near the message that prompted it.

Recommended behavior:

- if clarification payload exists, render a clarification block above the confirm controls
- if payload includes `candidateSymbols`, render them as simple chips or comma-separated tokens
- if no payload exists, fall back to the existing generic clarification message

### 3. Clarification should not change the workflow model

The UI must treat clarification payloads as explanatory only.

It should not:

- create a new phase
- invent a new workflow reason
- bypass the existing `clarification-required` state

The current workflow state machine stays untouched.

### 4. Clarification copy should be deterministic and brief

The panel should use stable UI strings derived from the clarification kind.

Recommended mapping:

- `missing-output-mint` -> `I still need to know which token you want.`
- `unknown-output-mint` -> `I found token hints, but not enough to safely identify one token.`
- `ambiguous-output-mint` -> `I found multiple possible token candidates.`
- `underspecified-request` -> `I need a more specific request before I can continue.`

Candidate symbols may be shown only when they exist and are short enough to be useful.

### 5. Clarification should remain visually distinct from blocked and failed

Clarification is not an error state.

The UI should keep it visually distinct from:

- `blocked`
- `failed`
- `unsupported-page`

That distinction matters because clarification is recoverable and should feel like a request for specificity, not a failure.

## Testing Strategy

Add Side Panel tests that cover:

- clarification payload with `missing-output-mint`
- clarification payload with `ambiguous-output-mint` and candidate symbols
- fallback behavior when no clarification payload is present
- no regression in blocked / failed rendering

Tests should verify visible text, not internal component state.

## Files

- Modify: `extension/src/shared/intent.ts`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/components/IntentSummaryCard.tsx`
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Modify: `extension/tests/sidepanel/action-card.test.tsx`
- Possibly modify: `extension/tests/sidepanel/sidepanel.test.tsx`

## Risks

- Overly detailed copy could make the clarification area feel noisy
- Under-rendering the payload would waste the new parser work
- Candidate symbol chips can become clutter if too many are shown at once
