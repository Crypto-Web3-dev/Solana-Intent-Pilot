# SIP Next-Phase Plan

## 0. Current Status

This document is the master entry point for all upcoming work. It builds on the completed foundational skeleton, real execution closed-loop, real execution preview, Wasm risk engine, and demo polish, while preserving the direction for remaining engineering wrap-up tasks.

## 1. Purpose

This file consolidates the follow-up work after the SIP skeleton is complete, so you don't have to re-read the entire documentation set every time you move forward.

For subsequent implementation, use this file as the primary entry point, then consult these authoritative documents as needed:

- [workflow-state-machine.md](../architecture/workflow-state-machine.md)
- [runtime-contracts.md](../api/runtime-contracts.md)
- [mvp-risk-policy.md](../security/mvp-risk-policy.md)
- [component-architecture.md](../design/component-architecture.md)
- [acceptance-criteria.md](../testing/acceptance-criteria.md)

## 2. Current Completion Status

Completed capabilities:

- `shared` runtime contracts
- `Background` main orchestration layer
- `Side Panel` base rendering and state display
- `content` page context collection
- `intent parse` OpenAI entry point with mock fallback
- Independent adapter boundaries for `risk`, `quote`, and `simulate`

This is sufficient to support subsequent integration with real on-chain pathways; the skeleton does not need to be redone.

## 3. Next-Phase Overview

### Phase A: Real Execution Closed-Loop

Goals:

- Make user confirmation after preview, wallet signing, transaction submission, and transaction confirmation form a real closed loop

Tasks:

- Integrate wallet state and signing entry point
- Complete the `awaiting-signature -> submitting -> confirmed` path as a real on-chain flow
- Define rollback behavior for signature cancellation, submission failure, and confirmation timeout
- Keep `workflow.state.changed` as the single source of truth for UI state

Phase output:

- Ability to complete a real or controlled-environment signed transaction demo

### Phase B: Real Execution Preview

Goals:

- Gradually replace current mock `quote / simulate` with real providers

Tasks:

- Integrate real quote service
- Integrate real simulation or equivalent pre-check service
- Retain mock fallback to ensure the development environment remains runnable
- Provide stable mapping for failure states, unknown states, and blocked states

Phase output:

- UI can display real routing, amounts, slippage, and simulation summary

### Phase C: Wasm Risk Engine Implementation

Goals:

- Upgrade the policy-based risk adapter layer into a runnable local risk module

Tasks:

- Design Rust risk rules and output structures
- Encapsulate Wasm loading and initialization
- Validate CSP, load paths, and performance under MV3 constraints
- Keep `SecurityReport` and `RiskLevel` unchanged; only replace the implementation

Phase output:

- Risk engine evolves from policy mock to locally executable module

### Phase D: Demo Experience Wrap-Up

Goals:

- Make the demo more stable, clearer, and better suited for presentation

Tasks:

- Strengthen copy for success, failure, and blocked states
- Tighten button states and CTA prompts
- Improve loading feedback, empty states, and contextual hints
- Prepare a 3-minute demo walkthrough

Phase output:

- A stable version ready for external presentation

### Phase E: Engineering Wrap-Up

Goals:

- Perform a final round of engineering cleanup after features are stable

Tasks:

- Align docs with implementation discrepancies
- Clean up deprecated mocks and transitional code
- Fill in missing tests
- Organize release artifacts and documentation

Phase output:

- A clean, well-structured main branch ready for continued iteration

## 4. Recommended Execution Order

Recommended sequence:

1. Real Execution Closed-Loop
2. Real Execution Preview
3. Wasm Risk Engine Implementation
4. Demo Experience Wrap-Up
5. Engineering Wrap-Up

Rationale:

- First, close the loop that is closest to user value
- Then replace the most obvious mocks
- Keep risk engine as a later but not omitted phase
- Finally, unify the experience and engineering details

## 5. Conventions

- All subsequent progress defaults to this file as the master entry point
- Only return to specialized documents for detailed confirmation when modifying runtime contracts, state machines, or risk policies
- No longer require re-reading the entire `docs/` directory each time

## 6. Actionable Task List

### 6.1 Real Execution Closed-Loop

- Integrate wallet state query and signing entry point
- Enable `Side Panel` to initiate confirmation in `awaiting-signature` state
- Have `Background` correctly handle `transaction.submitted`, `transaction.settled`, and `execution.cancelled`
- Add rollback paths for signature cancellation, submission failure, and confirmation completion
- Add regression tests for the execution chain

### 6.2 Real Execution Preview

- Connect `quote` adapter to real quote provider
- Connect `simulation` adapter to real simulation or pre-check provider
- Retain mock fallback to ensure local development usability
- Define UI mapping for quote failure, simulate failure, and unknown risk
- Add tests for the preview chain

### 6.3 Wasm Risk Engine Implementation

- Define input/output structures for Rust risk rules
- Add Wasm initialization and loading layer
- Validate load paths and CSP constraints under MV3
- Keep `SecurityReport` unchanged; only replace the implementation
- Write dedicated tests for high-risk, unknown, and missing data scenarios

### 6.4 Demo Experience Wrap-Up

- Tighten Side Panel first-screen layout
- Standardize copy for loading, blocked, failed, clarification, and unknown states
- Improve visual distinction between success and error states
- Prepare one successful demo path and one blocked demo path

### 6.5 Engineering Wrap-Up

- Align docs with implementation discrepancies
- Clean up transitional mocks and deprecated entry points
- Fill in missing tests
- Organize release notes and build artifacts

## 7. Suggested Start Order

1. Real Execution Closed-Loop
2. Real Execution Preview
3. Wasm Risk Engine Implementation
4. Demo Experience Wrap-Up
5. Engineering Wrap-Up

Benefits of this order:

- Start with what most affects "whether it actually works"
- Then replace the simulation layers most likely to break with real services
- Risk engine as an independent phase keeps risk and implementation boundaries clearer
- Do demo and wrap-up last so the structure is not disturbed
