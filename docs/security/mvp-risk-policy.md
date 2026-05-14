# SIP MVP Risk Policy

## 1. Purpose

This document defines the unified risk policy for SIP in the MVP stage, answering:

- Which conditions must block
- Which conditions only warn without blocking
- How `unknown` risk results are handled
- Whether preview, signing, or overriding risk advice is allowed

This document is the single-page authority for MVP risk decisions, taking priority over descriptive statements scattered across other documents.

## 2. Policy Scope

This policy applies to:

- Risk scan results for `SWAP` intents
- Local risk judgments after tokens are discovered on a page
- Action Card proceed, warn, and block decisions
- Risk expectations in demos and tests

This policy does not cover:

- Production-grade full-protocol risk control
- Blacklist governance and reputation systems
- Cross-step risk assessment for multi-step composite transactions

MVP security controls include:

- Page allowlist (`SUPPORTED_PAGE_MATCHES`): restricts content-script injection, page-context selection, and signable-tab injection to a fixed set of domains
- Input bounding constraints (`detect-context.ts`): body text, selected text, raw hints, address counts, and ticker counts all have hard upper limits
- Unsupported-page blocking: `unsupported-page` as an explicit `blocked` reason with a navigation entry to a supported page

## 3. Decision Principles

- Clear high-risk conditions are blocked with priority; no "risk detected but proceed by default"
- When data is insufficient, prioritize honest expression over fabricating safety
- Policy blocks and system failures must be distinguished
- LLMs can only provide explanations, not security endorsements
- MVP does not enable high-risk override by default

## 4. Risk Decision Output

The risk engine must ultimately produce these policy-facing conclusions:

- `level`
- `blocking`
- `checks`

Recommended interpretation:

- `level`: risk level displayed to the user
- `source`: risk engine source displayed to the user, distinguishing `wasm` from `policy-fallback`
- `blocking`: whether to block, consumed by the workflow
- `checks`: specific reasons for UI and debugging

## 5. Risk Level Definitions

### 5.1 `low`

Meaning:

- Completed checks found no significant risk

MVP action:

- Allow continued preview
- Allow entering the signing pipeline

### 5.2 `medium`

Meaning:

- Risks worth noting exist, but below the default blocking threshold

MVP action:

- Allow continued preview
- Allow entering the signing pipeline
- Must show a clear warning in the UI

### 5.3 `high`

Meaning:

- An explicit blocking rule was hit, or composite risk reached the high-risk threshold

MVP action:

- Block by default
- Do not allow entering the signing pipeline
- Primary CTA disabled; only cancel or back allowed

### 5.4 `unknown`

Meaning:

- Insufficient data to complete a minimum credible judgment

MVP action:

- Not directly equivalent to `high`
- Allow continued preview by default
- Whether entering the signing pipeline is allowed depends on whether minimum check coverage is still met
- Must prominently indicate "insufficient data, does not mean safe"

## 6. MVP Blocking Strategy

### 6.1 Explicit Rule Blocking

The following conditions are blocked with priority when hit:

- Intent fails schema validation
- `outputMint` missing or invalid
- `Mint Authority` detected
- Risk score `< 50`
- Quote failed with no fallback route
- Simulation failed

Note:

- Explicit rule blocking takes priority over score interpretation
- When a blocking rule is hit, even if other signals are favorable, the transaction must not be allowed

### 6.2 Score Blocking

When no higher-priority rule is hit:

- `score < 50` is treated as `high`
- `blocking = true` by default

### 6.3 Non-Blocking Warnings

The following conditions only warn by default in MVP:

- `confidence < 0.5` and `needsClarification = true`
- `0.5 <= confidence < 0.85`
- `Freeze Authority` detected
- Liquidity data missing
- Holder concentration too high
- RPC response unusually slow

## 7. `unknown` Policy

### 7.1 When to Mark as `unknown`

`unknown` should be returned with priority when:

- Key auxiliary data such as liquidity or holders is missing
- Minimum check coverage cannot be completed
- A credible conclusion of "safe" or "high risk" cannot be reached

### 7.2 `unknown` Default Action

MVP default rules:

- `unknown` does not directly trigger blocking
- `unknown` must not be mapped to `low`
- `unknown` allows continued preview
- Before `unknown` enters the signing pipeline, the UI must again clearly indicate "current judgment is incomplete"

### 7.3 `unknown` UI Requirements

The UI must:

- Be visually distinct from `high`
- Be visually distinct from `failed`
- Display "insufficient data" rather than "minor risk"

Recommended copy:

- `Some risk data is currently unavailable; please judge carefully`
- `Only partial checks could be completed; this result does not guarantee asset safety`

## 8. Rule Priority

MVP uses the following priority order:

1. Structural invalidity and execution precondition failure
2. Explicit blocking rules
3. Score threshold blocking
4. `unknown` insufficient data notice
5. Ordinary warnings

Explanation:

- Structural invalidity and execution precondition failure mean "cannot execute"
- Explicit blocking rules mean "policy forbids"
- `unknown` means "information is incomplete"
- Low-confidence clarification means "need more information before deciding"
- Ordinary warnings mean "may proceed, but be reminded"

## 9. Boundaries for Proceeding

### 9.1 Allow Continued Preview

The following conditions allow continued preview:

- `level = low`
- `level = medium`
- `level = unknown` with no explicit blocking rule hit

### 9.2 Allow Continued Signing

The following conditions allow entering the signing pipeline:

- `level = low`
- `level = medium`
- `level = unknown` and:
  - Intent is valid
  - Risk checks have been completed
  - No explicit blocking rule was hit
  - UI has prominently warned about insufficient risk data

### 9.3 Do Not Allow Continued Signing

The following conditions do not allow entering the signing pipeline:

- `blocking = true`
- Structural invalidity
- `needsClarification = true`
- Quote or simulate failure
- User has not confirmed

## 10. Override Policy

MVP conclusion:

- High-risk override is not enabled by default

Therefore:

- No "proceed with transaction" button in `blocked` state
- Demo does not depend on override
- Tests are not required to cover override interactions

If override is opened in the future, minimum requirements should include:

- Second confirmation
- Display the rule ID
- Make it explicit that the user is voluntarily proceeding against safety advice

## 11. Suggested Implementation Mapping

### 11.1 Risk Engine to Policy Layer

The implementation should map risk engine output to:

```ts
type RiskPolicyDecision = {
  level: "low" | "medium" | "high" | "unknown";
  blocking: boolean;
  allowPreview: boolean;
  allowSigning: boolean;
  primaryReason: string;
  triggeredRules: string[];
};
```

### 11.2 Policy Layer to UI Layer

The UI should not make primary decisions based on raw check items, but consume policy layer conclusions:

- `allowPreview`
- `allowSigning`
- `triggeredRules`
- `primaryReason`

This prevents components from independently inventing their own risk logic.

## 12. Testing & Acceptance Requirements

MVP must verify the following paths at minimum:

- `Mint Authority` hit results in blocking
- `Freeze Authority` only warns without blocking
- `confidence < 0.5` and `needsClarification = true` returns to clarification path rather than `blocked`
- Missing liquidity data returns `unknown`
- `unknown` scenario is not displayed as safe/passed
- `high` risk scenario does not show a proceed-to-signing entry
- `failed` and `blocked` are visually distinguishable in the UI

## 13. Relationship to Other Documents

- Aligned with [blocking-rules.md](./blocking-rules.md) for rule list
- Aligned with [risk-engine.md](./risk-engine.md) for risk output structure
- Aligned with [trust-boundaries.md](./trust-boundaries.md) for default safety principles
- Aligned with [risk-cases.md](./risk-cases.md) for case expectations
- Aligned with [../api/ui-state-mapping.md](../api/ui-state-mapping.md) for UI behavior
