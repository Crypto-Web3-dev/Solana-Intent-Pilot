# SIP Blocking Rules Table

## 1. Goal

This document defines which conditions block SIP execution and which conditions only produce warnings, preventing risk judgments from drifting during implementation.

## 2. Blocking Principles

- Conditions that are clearly identifiable as high risk are blocked by default
- Missing data is preferentially warned, not easily disguised as safe
- Blocks must be explainable and traceable to a specific rule
- In the MVP stage, rules should be conservative rather than allowing clearly dangerous transactions

## 3. Rule List

| Rule ID | Condition | Default Action | Reason |
| --- | --- | --- | --- |
| `BR-01` | Intent fails schema validation | Block | Cannot guarantee correct execution target |
| `BR-03` | `outputMint` is missing or invalid | Block | Target asset is unclear |
| `BR-04` | Mint Authority detected | Block | Mint inflation risk exists |
| `BR-05` | Risk score `< 50` | Block | Overall risk is too high |
| `BR-06` | Quote fails and no fallback route exists | Block | Cannot provide an executable preview |
| `BR-07` | Simulation fails | Block | Cannot verify pre-sign result |
| `BR-08` | User has not confirmed signature | Block | Missing final authorization |
| `BR-09` | Current page is not in the `SUPPORTED_PAGE_MATCHES` whitelist | Block | Injection target is untrusted; both wallet-detection and signature-submission phases are intercepted |

## 4. Warning Rules

| Rule ID | Condition | Default Action | Reason |
| --- | --- | --- | --- |
| `WR-01` | `confidence < 0.5` and `needsClarification = true` | Clarify | Insufficient information; user must supplement before a decision can be made |
| `WR-02` | `0.5 <= confidence < 0.85` | Warn | Low confidence; user attention required |
| `WR-03` | Freeze Authority detected | Warn | Default in MVP is not to block independently |
| `WR-04` | Liquidity data is missing | Warn | Cannot fully assess exit risk |
| `WR-05` | Position concentration is too high | Warn | Dump risk exists |
| `WR-06` | RPC response is abnormally slow | Warn | Results may be unstable |

Supplementary rule priorities:

- When `confidence < 0.5` and `needsClarification = true`, enter the clarification path first rather than `blocked`
- Explicit rule blocking takes priority over score threshold blocking
- When `Mint Authority` is hit, block even if the total score has not fallen below the threshold
- `Freeze Authority` defaults to a warning in MVP and should not be escalated to a block on its own
- When the risk result is `unknown`, do not block directly by default, but must attach a prominent warning and must not express it as safe

## 5. Override Recommendations

MVP recommendations:

- Do not enable high-risk override by default
- If override must be demonstrated, only allow proceeding under explicit secondary confirmation

If override is opened later, it is recommended to require:

- A re-confirmation dialog
- Clear display of the triggered blocking rule ID
- Clear indication that the user is voluntarily bypassing the safety recommendation

## 6. UI Requirements

- Every block must display at least one specific reason
- Display the corresponding rule ID where possible for debugging convenience
- It is not allowed to only show "Transaction failed" without indicating it is a risk block
- `unknown` risk results must be visually distinct from `blocked` and `failed`
- `unsupported-page` blocks should display independent copy (e.g., "Supported Page Required") and provide a link to navigate to a supported page
- The clarification path must be visually distinct from `blocked` and `failed`

## 7. Future Evolution

- Set different thresholds for different `intent` types
- Set differentiated policies for trusted token lists
- Sync blocking rules to the test matrix and QA checklist
