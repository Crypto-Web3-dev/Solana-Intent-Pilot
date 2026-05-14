# SIP Test Matrix

## 1. Purpose

This document organizes the test scope across three dimensions — "Feature x State x Environment" — to help prioritize coverage of the most critical scenarios when time is limited.

## 2. Feature Dimension

| Feature | Key Scenario | Priority |
| --- | --- | --- |
| Page Awareness | Page detects token or address | P0 |
| Intent Parsing | Natural language generates valid Intent | P0 |
| Risk Scanning | High risk triggers blocking | P0 |
| Transaction Preview | Action Card displays correctly | P0 |
| Wallet Execution | Can invoke signing and return result | P0 |
| Error Handling | LLM / RPC / simulate failure | P1 |
| UI Details | Narrow panel adaptation, state styles | P1 |

## 3. State Dimension

| State | Example | Priority |
| --- | --- | --- |
| Success | Successful parsing, preview, signing | P0 |
| Low Confidence | Unable to determine target token | P0 |
| Risk Blocking | Mint Authority risk | P0 |
| Quote Failure | RPC or Jupiter exception | P1 |
| Simulation Failure | `simulateTransaction` returns error | P1 |
| User Cancellation | Wallet signing aborted | P1 |

## 4. Environment Dimension

| Environment | Description | Priority |
| --- | --- | --- |
| Local Static Mock | Not connected to real LLM / on-chain services | P0 |
| Local Real API | Connected to real LLM, RPC, Jupiter | P0 |
| Demo Environment | Stable environment for rehearsal and screen recording | P0 |
| Weak Network | Simulating slow or failing APIs | P1 |

## 5. Recommended Minimum Coverage Set

### 5.1 P0 Must-Test

- Page awareness success
- Intent parsing success
- High risk successfully blocked
- Action Card displayed successfully
- Wallet signing invoked successfully

### 5.2 P1 Suggested Additional Tests

- Low-confidence scenario
- Quote failure
- Simulation failure
- User cancels signing
- Error prompts under weak network

## 6. Recommended Test Order

1. Use `sample-payloads` to run through static mocks
2. Connect to real LLM and RPC to verify the success chain
3. Use `risk-cases` to verify the blocking chain
4. Finally, run through the full demo rehearsal flow

## 7. Result Recording Suggestions

Each test round should record at least:

- Date
- Environment
- Test page
- Result: pass / fail
- Issue summary

If time permits, a `test-report.md` template can be added later for standardized recording.
