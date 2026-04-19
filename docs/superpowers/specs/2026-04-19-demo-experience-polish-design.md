# Demo Experience Polish Design

## Goal

Make the SIP Side Panel feel like a stable, demo-ready product by tightening copy, visual hierarchy, and state-specific CTA behavior without changing workflow semantics.

## Why This Slice

The extension already has the core product behaviors in place:

- intent parsing
- risk scanning
- quote and simulation preview
- wallet status handling
- clarification payload rendering
- unsupported-page blocking

What still feels unfinished is the presentation layer. The current panel works, but the demo story is still a little noisy:

- the first screen reads as a technical scaffold rather than a polished product
- some states have strong semantics but weak visual separation
- loading / blocked / failed / clarification / unknown messages are technically correct but not yet consistently polished

This slice is about making the existing experience easier to show, explain, and trust.

## Scope

In scope:

- tighten Side Panel copy and hierarchy
- make success, warning, blocked, failed, and clarification states more visually distinct
- improve demo CTAs for the main happy path and the blocked path
- ensure unknown risk is visually cautionary and not success-like
- make the unsupported-page path feel like an intentional product state instead of an error condition

Out of scope:

- changing workflow phase definitions
- changing risk policy thresholds
- changing wallet submission behavior
- changing parser logic
- changing quote, simulation, or risk contracts
- adding new integrations

## Existing Constraints

This slice must stay aligned with the current docs and runtime contracts:

- `workflow.state.changed` remains the source of truth for state transitions
- `unknown` remains a risk label, not a workflow phase
- `needsClarification` remains intent metadata, not a workflow phase
- `blocked`, `failed`, and clarification states must remain visually distinct
- `unknown` must never look like a success state

## Recommended Approach

### Option 1: Minor copy clean-up only

Pros:

- very low risk
- quick to ship

Cons:

- not enough to make the demo story feel product-grade

### Option 2: Tighten copy plus state-specific CTA / visual hierarchy

Pros:

- improves the demo story without changing behavior
- keeps the UI honest about each state
- makes the happy path and blocked path easier to present

Cons:

- requires a few coordinated UI updates across the panel

### Option 3: Rebuild the panel layout for a more dramatic visual redesign

Pros:

- could look more polished

Cons:

- too large for a demo-polish slice
- risks destabilizing a UI that already works

Recommendation: Option 2.

## Design

### 1. Keep the current information model, improve the presentation

The panel already has the right sections:

- request
- workflow state
- intent + risk
- execution

The slice should keep these sections, but refine how they read visually and narratively:

- the request area should feel like an intentional entry point
- the workflow area should explain progress, not just list fields
- the risk area should clearly separate `unknown`, `medium`, `high`, and `blocked`
- the execution area should highlight the primary CTA and make fallback actions feel secondary

### 2. Make the demo path obvious

The happy path should read as:

- request
- parse
- risk
- preview
- confirm
- submit
- confirmed

The blocked path should read as:

- request
- parse
- risk blocked
- stop with clear explanation

The UI should guide a demo presenter toward these two stories without having to narrate internal implementation detail.

### 3. Clarify state-specific messages

The copy should be tightened so that:

- `loading` states feel active, not vague
- `clarification` states feel like a productive next step, not an error
- `unknown` states clearly say the data is incomplete
- `blocked` states feel final and policy-driven
- `failed` states feel technical and recoverable, not policy-driven

### 4. Keep unsupported-page as a deliberate product state

The unsupported-page branch should read as:

- “this action must happen in a normal web page”
- not “something broke”

That means the CTA and explanatory copy should be obvious, calm, and actionable.

### 5. Preserve current demos and tests

The slice should not change the underlying workflow behavior. It should only refine what the user sees and how the primary CTA is framed.

## Testing Strategy

Add or adjust tests for:

- happy-path panel copy and CTA presence
- blocked-path CTA and explanation
- clarification path rendering
- `unknown` risk presentation staying cautionary
- unsupported-page presentation staying actionable

Tests should prefer string assertions on the rendered panel fragments or server-rendered HTML, since this slice is about presentation and copy.

## Files

- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Possibly modify: `extension/src/sidepanel/components/DetectionBar.tsx`
- Modify: `extension/tests/sidepanel/action-card.test.tsx`
- Modify: `extension/tests/sidepanel/risk-indicator.test.tsx`
- Possibly modify: `extension/tests/sidepanel/sidepanel.test.tsx`

## Risks

- over-polishing could make the panel visually busy
- changing copy too much could make demo narration harder instead of easier
- the UI must not make `unknown` or `failed` look like success states
- the blocked path must remain clearly final

## Success Criteria

- The Side Panel feels intentionally designed rather than scaffold-like
- Happy-path and blocked-path demos are easy to explain
- Clarification, blocked, failed, and unknown states remain clearly distinct
- No workflow semantics change
- Existing tests can be updated to reflect the refined copy and hierarchy
