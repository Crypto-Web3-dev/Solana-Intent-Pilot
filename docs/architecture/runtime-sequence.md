# SIP Runtime Sequence

## 1. Goal

This document describes the runtime sequence of SIP during a typical user operation, helping to unify during implementation:

- Who triggers whom first
- Which steps are synchronous perception, and which are asynchronous orchestration
- Which phases must wait for results, and which can proceed in parallel

## 2. Happy Path

The following is a standard `detect -> parse -> scan -> quote -> simulate -> sign -> submit` flow:

```text
User
  -> Side Panel: Enter "buy 1 SOL of this token"
Side Panel
  -> Background: intent.parse.requested
Background
  -> Context Store: Read current tab's context snapshot
Background
  -> LLM Service: parse intent
LLM Service
  -> Background: SIPIntent
Background
  -> Side Panel: workflow.state.changed(parsing -> risk-checking)
Background
  -> RPC Provider: getAccountInfo(outputMint)
RPC Provider
  -> Background: mint account data
Background
  -> Wasm Engine: scan_risk(intent_json)
Wasm Engine
  -> Background: SecurityReport
Background
  -> Jupiter Adapter: get quote
Jupiter Adapter
  -> Background: best route + output estimate
Background
  -> Execution Adapter: simulate transaction
Execution Adapter
  -> RPC Provider: simulateTransaction
RPC Provider
  -> Background: simulation result
Background
  -> Side Panel: execution.preview.ready
User
  -> Side Panel: Click confirm
Side Panel
  -> Background: execution.confirmed
Background
  -> Wallet Provider: request signature
Wallet Provider
  -> Background: signed transaction
Background
  -> RPC Provider: send transaction
RPC Provider
  -> Background: signature / confirmation
Background
  -> Side Panel: workflow.state.changed(confirmed)
```

## 3. Phase Breakdown

### 3.1 Perception Phase

Trigger conditions:

- Page load
- DOM change
- User text selection

Output:

- `DetectedContextSnapshot`

Characteristics:

- Can continuously update in the background
- Does not depend on explicit user triggering

### 3.2 Parsing Phase

Trigger conditions:

- User submits natural language input

Output:

- `SIPIntent`

Characteristics:

- Must carry `requestId`
- Must pass schema validation

### 3.3 Risk Control Phase

Trigger conditions:

- `requiresRiskScan = true`

Output:

- `SecurityReport`

Characteristics:

- Default is serial, blocking subsequent execution preview
- Can later be optimized to run quote and partial scan in parallel, but must rendezvous before final display

### 3.4 Preview Phase

Trigger conditions:

- Risk not blocked

Output:

- Quote result
- Simulation result
- Action Card

### 3.5 Execution Phase

Trigger conditions:

- User confirmation

Output:

- Wallet signature
- On-chain submission result
- Success or failure status

## 4. Parallel and Serial Recommendations

Recommended serial:

- `parse -> validate`
- `risk -> block/allow`
- `sign -> submit`

Can be parallelized for optimization:

- Fetching mint data and fetching quote
- Fetching token metadata and preparing risk result rendering

However, no parallel optimization can skip the following gates:

- Intent validation passed
- Risk check completed or explicitly marked as skippable
- User final confirmation

## 5. Exception Paths

### 5.1 Invalid LLM Output

- Background marks `failed`
- Side Panel displays "Could not parse as executable intent"
- Preserve user input, allow re-submission

### 5.2 Needs Clarification

- Intent structure is valid, but `needsClarification = true`
- Background does not enter the quote, simulation, and signature chain
- Side Panel prompts user to confirm target asset, amount, or condition before re-submitting

### 5.3 Risk Block

- Background marks `blocked`
- Side Panel displays high-risk explanation
- Does not enter signature flow

### 5.4 Quote or Simulation Failure

- Preserve intent and risk results
- Display `quote unavailable` or `simulation failed`
- Allow user to retry or switch nodes

### 5.5 User Cancels Signature

- Workflow returns to `idle` or `ready`
- Preserve most recent preview card for re-initiation

## 6. Implementation Reminders

- All phase events should be written to the unified workflow state
- Every external call should include a timeout and error reason
- UI should not assemble its own timing; it should only render the state machine and result objects
