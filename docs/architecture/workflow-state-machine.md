# SIP Workflow State Machine

## 1. Goal

This document defines the single-request workflow state machine for SIP at the MVP stage, serving as the unified reference for runtime implementation, UI mapping, test assertions, and error handling.

It answers four questions:

- How many official states does the current request have
- How does each state get entered and exited
- Which exceptions are "failures," which are "blocks," and which are just "needs clarification"
- Which data should be preserved and which should be cleared

## 2. Scope

This state machine only describes the "intent execution workflow for a single `requestId`," and does not cover:

- Long-running background listeners for page perception
- Wallet connection state itself
- Global network state or node health status
- Multi-request concurrent scheduling strategies

These capabilities may exist, but none should break the determinism of the single-request state machine.

## 3. Authority Principles

- `Background` is the sole primary orchestration layer
- `workflow.state.changed` is the authoritative source for UI state consumption
- `Side Panel` does not derive the next state on its own; it only renders state and sends user actions
- `unknown` is a risk label, not a workflow state
- `needsClarification` is Intent metadata, not a workflow state

## 4. State List

```ts
type WorkflowPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "risk-checking"
  | "quoting"
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "failed"
  | "blocked";
```

### 4.1 `idle`

Meaning:

- No active request currently in progress

Typical behavior:

- Display empty state, recent context, or the most recent reusable preview

### 4.2 `detecting`

Meaning:

- Updating current page context

Notes:

- This is the page perception phase, and does not imply an executable request exists
- Can appear adjacent to `idle`, but should not override the core execution state of an already-started request

### 4.3 `parsing`

Meaning:

- User input received, generating and validating `SIPIntent`

### 4.4 `risk-checking`

Meaning:

- Intent has been validly generated, and risk scanning is required

### 4.5 `quoting`

Meaning:

- Fetching quotes and route information

### 4.6 `simulating`

Meaning:

- Quote completed, simulating pre-signature results

### 4.7 `awaiting-signature`

Meaning:

- Preview is ready, waiting for user to confirm signature in wallet

### 4.8 `submitting`

Meaning:

- Signature obtained, submitting on-chain and awaiting confirmation

### 4.9 `confirmed`

Meaning:

- Transaction successfully submitted and confirmed, or reached the success criteria recognized by MVP

### 4.10 `failed`

Meaning:

- Process terminated due to system error, external dependency failure, invalid structure, or unrecoverable exception

Typical causes:

- LLM output structure invalid
- Quote failed
- Simulation failed
- RPC timeout with no available fallback

### 4.11 `blocked`

Meaning:

- Process strategically blocked due to an explicit risk rule

Typical causes:

- `Mint Authority` triggered a blocking rule
- Comprehensive risk score reached blocking threshold
- Other defined hard blocking rules triggered

## 5. Standard Transitions

### 5.1 Happy Path

```text
idle
  -> parsing
  -> risk-checking
  -> quoting
  -> simulating
  -> awaiting-signature
  -> submitting
  -> confirmed
```

### 5.2 Path That Can Skip Risk Scanning

```text
idle
  -> parsing
  -> quoting
  -> simulating
  -> awaiting-signature
  -> submitting
  -> confirmed
```

Condition:

- `requiresRiskScan = false`

### 5.3 Page Perception Path

```text
idle
  -> detecting
  -> idle
```

Notes:

- `detecting` is used for context refresh perception
- It is not part of the execution chain

## 6. Exceptions and Branches

### 6.1 Invalid Structure

Trigger condition:

- LLM output cannot pass schema validation

Transition:

```text
parsing -> failed
```

Requirements:

- Preserve user's original input
- Return a clear error reason
- Do not enter the risk, quote, or signature chain

### 6.2 Needs Clarification

Trigger condition:

- Intent structure is valid
- `needsClarification = true`

Transition:

```text
parsing -> idle
```

Requirements:

- Do not enter the quote, simulation, or signature chain
- UI must preserve the parsed result summary and clarification prompt
- Should not be mistakenly labeled as `failed`

Notes:

- `needsClarification` is a "recoverable wait state" that stays at `idle` and can be re-initiated
- MVP stage does not add a separate `clarifying` workflow state, avoiding premature state machine bloat

### 6.3 Risk Block

Trigger condition:

- Risk scan triggered a blocking rule

Transition:

```text
risk-checking -> blocked
```

Requirements:

- Preserve risk report and failed check items
- Do not enter the signature chain
- UI must explicitly display the rule reason, not just "failed"

### 6.4 Quote Failure

Trigger condition:

- Quote retrieval failed with no available fallback

Transition:

```text
quoting -> failed
```

Requirements:

- Preserve valid intent
- If risk results exist, preserve them as well
- Allow user to retry

### 6.5 Simulation Failure

Trigger condition:

- `simulateTransaction` returned an error or could not complete

Transition:

```text
simulating -> failed
```

Requirements:

- Must not disguise as signable success
- Should preserve preview context for user to understand where the failure occurred

### 6.6 User Cancels Signature

Trigger condition:

- Wallet rejected signature or user actively cancelled

Transition:

```text
awaiting-signature -> idle
```

Requirements:

- Preserve the most recent preview card
- Do not enter `failed`
- UI allows user to initiate confirmation again

### 6.7 Submission Failure

Trigger condition:

- Signed, but submission or confirmation chain failed

Transition:

```text
submitting -> failed
```

Requirements:

- Display failure reason and currently known transaction information
- Avoid leaving UI stuck in permanent submission state

## 7. State Transition Table

| Current State | Trigger Event | Next State | Notes |
| --- | --- | --- | --- |
| `idle` | User submits input | `parsing` | Create new `requestId` |
| `idle` | Page perception refresh | `detecting` | Not in execution chain |
| `detecting` | Context update completed | `idle` | Return to input-ready state |
| `parsing` | Intent valid and requires risk check | `risk-checking` | Enter scanning |
| `parsing` | Intent valid and no risk check needed | `quoting` | Enter preview chain directly |
| `parsing` | Invalid structure | `failed` | Enter parse failure |
| `parsing` | `needsClarification = true` | `idle` | Preserve clarification info |
| `risk-checking` | Risk check passed | `quoting` | Enter quotation |
| `risk-checking` | Risk check blocked | `blocked` | Strategic termination |
| `risk-checking` | Risk check call failed | `failed` | System failure |
| `quoting` | Quote succeeded | `simulating` | Enter simulation |
| `quoting` | Quote failed | `failed` | Preserve context |
| `simulating` | Simulation succeeded | `awaiting-signature` | Await confirmation |
| `simulating` | Simulation failed | `failed` | Stop execution |
| `awaiting-signature` | User confirms signature | `submitting` | Signature obtained |
| `awaiting-signature` | User cancels signature | `idle` | Preserve preview |
| `submitting` | On-chain confirmation succeeded | `confirmed` | Complete |
| `submitting` | Submission or confirmation failed | `failed` | Terminate |
| `confirmed` | New request starts | `parsing` | Create new `requestId` |
| `failed` | User retries | `parsing` | Can re-submit |
| `blocked` | User returns or modifies input | `idle` | No override allowed |

## 8. Data Retention Rules

### 8.1 Must Preserve

- `requestId`
- User's original input
- Most recent valid `SIPIntent`
- Most recent risk report
- Most recent preview result
- Final error reason or block reason

### 8.2 Can Clear

- Stale loading states
- Temporary animation markers bound to old `requestId`
- Intermediate log caches that are no longer visible

### 8.3 Special Rules

- After `failed`, data needed to locate the error should not be lost
- After `blocked`, risk details should not be lost
- On `awaiting-signature -> idle`, try to preserve the most recent preview for easy re-confirmation

## 9. UI Mapping Requirements

- `failed` must be distinguishable from `blocked`
- `needsClarification` must be distinguishable from `failed`
- `unknown` risk label must be distinguishable from `high`
- All CTA states are determined jointly by workflow state and risk label

Recommended rules:

- `blocked`: Primary CTA disabled, only allow cancel or return
- `failed`: Allow retry
- `awaiting-signature`: Primary CTA shows waiting for signature
- `unknown`: If policy allows continuing, must attach a prominent warning; must not render as passed

## 10. Implementation Suggestions

- Maintain the sole state machine in `background/workflow-engine.ts`
- Write unified logs for each state transition, including `requestId`, `from`, `to`, `reason`
- Do not let UI derive state on its own based on scattered events
- Use explicit metadata for `needsClarification` instead of implicit field absence

## 11. Relationship with Other Documents

- Aligns phase ordering with [runtime-sequence.md](./runtime-sequence.md)
- Aligns message sources and orchestration responsibilities with [message-flow.md](./message-flow.md)
- Aligns state enumerations with [../api/message-types.md](../api/message-types.md)
- Aligns UI behavior with [../api/ui-state-mapping.md](../api/ui-state-mapping.md)
- Aligns blocking criteria with [../security/blocking-rules.md](../security/blocking-rules.md)
