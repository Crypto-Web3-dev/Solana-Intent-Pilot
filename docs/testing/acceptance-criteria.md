# SIP Acceptance Criteria

## 1. Purpose

This document defines the acceptance criteria for the SIP MVP, serving as a unified basis for determining when development, self-testing, and demo preparation are complete.

## 2. MVP Acceptance Scope

The MVP must cover at least the following end-to-end loop:

- Page context detection
- Natural language intent parsing
- Local risk scanning
- Quote and simulation preview
- Wallet signing and result feedback

## 3. Functional Acceptance Criteria

### 3.1 Page Awareness

Acceptance criteria:

- Able to identify at least one token clue or Solana address on the target page
- Side Panel can display a context summary of the current page
- Context updates or clears when the user switches pages

Pass condition:

- When the user opens a supported page, they can see the Detection Bar or context card

### 3.2 Intent Parsing

Acceptance criteria:

- After the user inputs natural language, the system returns a valid `SIPIntent`
- Three categories of results — invalid structure, low confidence, and needs clarification — all have clear prompts
- The UI displays a parsing summary rather than raw JSON

Pass condition:

- At least 3 typical inputs can stably generate verifiable Intents

### 3.3 Risk Scanning

Acceptance criteria:

- Returns a structured risk report for the target mint
- High-risk results trigger blocking
- When risk data is missing, displays `unknown` and never appears as safe

Pass condition:

- Can at least distinguish between `low` / `high` / `unknown` severity levels

### 3.4 Transaction Preview

Acceptance criteria:

- Can return a quote result
- Action Card displays input/output assets, slippage, and simulation summary
- When quoting or simulation fails, provides an understandable error message

Pass condition:

- The user can see a complete preview card before signing

### 3.5 Transaction Execution

Acceptance criteria:

- After user confirmation, invokes wallet signing
- On success, the UI displays the on-chain submission result
- When the user cancels signing, the UI does not get stuck in the submitting state

Pass condition:

- Completes one signing flow verification in a real or controlled test environment

## 4. Security Acceptance Criteria

- Intents that fail schema validation must not enter the execution chain
- Intents with `needsClarification = true` must not enter the quote and signing chain
- High-risk blocking must include a specific reason
- Before signing, input assets, output assets, and protocol source must be displayed
- Misleading expressions such as "AI has verified this is safe" must never appear
- High-risk override is disabled by default in the MVP

## 5. UX Acceptance Criteria

- The Side Panel first screen has a clear structure
- The user can understand which stage they are currently in
- Error states and loading states are clearly distinguishable
- Key CTAs are always clear and unambiguous

## 6. Demo Acceptance Criteria

- Can demonstrate the complete end-to-end loop within 3 minutes
- At least one success path is prepared
- At least one risk blocking path is prepared
- Page awareness and Action Card must have obvious visual feedback

## 7. Definition of Done

The SIP MVP can be considered ready for demo acceptance when all of the following conditions are simultaneously met:

- Core end-to-end functionality is operational
- Major error paths have feedback
- Documentation is consistent with the current implementation
- Critical items in the QA checklist have been reviewed
