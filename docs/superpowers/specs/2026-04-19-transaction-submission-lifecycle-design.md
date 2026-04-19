# Transaction Submission Lifecycle Design

## Goal

Define how SIP should handle the wallet submission lifecycle after a user confirms signing, including submitted, settled, timeout, and retry behavior, without changing the main workflow state machine.

## Why This Slice

SIP already reaches the signature boundary and can hand off to the page-world wallet bridge. The remaining gap is the lifecycle after the wallet accepts a signing request:

- when do we mark submission as started
- what is the difference between `submitted` and `confirmed`
- how long do we wait for settlement
- what happens if settlement never arrives
- what retry behavior is allowed before we surface a failure

Without this slice, the closing part of the execution flow is still partly implied by mock behavior and UI timing, not by a clear contract.

## Scope

In scope:

- define the post-signature submission lifecycle
- define timeout and retry behavior for transaction submission
- define how `transaction.submitted`, `transaction.settled`, and `transaction.failed` should be produced
- define the UI-facing interpretation of submitted vs confirmed states
- add deterministic tests around submission lifecycle behavior

Out of scope:

- changing the workflow state machine states
- changing wallet provider discovery
- changing quote or simulation behavior
- changing risk policy
- adding background polling for on-chain finality beyond the submission window

## Existing Constraints

This slice must remain consistent with current docs and code:

- `awaiting-signature` remains the point where the user confirms
- `submitting` means we have handed a request to the wallet bridge and are waiting on submission-related progress
- `transaction.submitted` and `transaction.settled` already exist as runtime messages
- `confirmed` remains the final success condition
- `execution.cancelled` and `transaction.failed` must still be available as terminal failure paths

## Recommended Approach

### Option 1: Keep the current immediate settle behavior

Pros:

- minimal code

Cons:

- doesn't model real submission timing
- hides timeout behavior
- makes it hard to test failure boundaries

### Option 2: Add a small submission lifecycle manager with timeout and retry rules

Pros:

- deterministic
- testable
- aligns with the real execution boundary

Cons:

- adds one focused piece of lifecycle logic

### Option 3: Move all settlement handling into the wallet bridge

Pros:

- fewer moving parts in the background

Cons:

- makes the bridge responsible for too much
- harder to reason about workflow transitions

Recommendation: Option 2.

## Design

### 1. Submission should be a distinct phase of the closeout flow

After the user confirms signing:

- the UI enters `submitting`
- the wallet bridge returns a submission result or failure
- the background/router records `transaction.submitted`
- the background/router can later record `transaction.settled`

This slice defines the waiting behavior between those events.

### 2. Submitted does not mean confirmed

`transaction.submitted` should mean:

- the wallet accepted the request
- a transaction signature exists
- we have a candidate for chain settlement

It should not mean:

- final confirmation has already happened
- the operation is safe to treat as irreversible success

`transaction.settled` is the success completion event.

### 3. Add a bounded settlement wait window

The submission lifecycle should wait for settlement for a fixed, deterministic window after `transaction.submitted`.

Recommended policy:

- start a short timer after submission
- if settlement arrives before timeout, mark confirmed
- if timeout expires, surface a submit failure or timeout failure depending on what the wallet reported

This keeps the UX honest without requiring perpetual polling.

### 4. Allow one retry for transient submission failure

Some submission failures are transient and should be retried once automatically if they occur before final settlement handling.

The retry policy should be narrow:

- one retry only
- only for transient submission errors
- do not retry explicit user cancellation
- do not retry page unsupported errors

This keeps the behavior predictable and avoids hidden loops.

### 5. Lifecycle outcomes

The lifecycle should converge into one of these user-visible outcomes:

- success: `submitted` then `settled` then `confirmed`
- cancelled: user aborts before submission completes
- failure: submission fails or settlement timeout expires

The background/router should remain the authoritative source for phase transitions.

### 6. UI interpretation

The Side Panel should distinguish:

- `submitting`: waiting on wallet/network handoff
- `submitted`: wallet accepted and a signature exists
- `confirmed`: chain settlement is complete

Even if the workflow state machine still exposes only `submitting` and `confirmed` as phases, the UI should surface the intermediate lifecycle status clearly when available.

## Testing Strategy

Add tests that cover:

- successful submission followed by settlement
- explicit submission failure
- timeout path after submission without settlement
- one allowed retry for transient submission errors
- no retry for unsupported-page or cancellation cases

These tests should verify routing and lifecycle semantics at the background/router boundary.

## Files

- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/background/message-router.ts`
- Modify: `extension/src/background/workflow-engine.ts`
- Modify: `extension/tests/background/workflow-engine.test.ts`
- Possibly modify: `extension/tests/sidepanel/action-card.test.tsx`

## Risks

- a too-short timeout can make the UI feel flaky
- a too-long timeout can make submission feel stuck
- retrying the wrong class of failures could hide real problems
- if submitted vs confirmed is not rendered distinctly, users may think the flow completed too early
