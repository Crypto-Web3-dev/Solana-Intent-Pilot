# Spec: Wasm Risk Engine Deep Scan (Rule-Chain Verdict)

- **Date**: 2026-04-27
- **Status**: Draft
- **Topic**: Enhancing the Rust/Wasm risk engine with sophisticated rule-chain logic and backend data enrichment.

## 1. Overview
The current Wasm risk engine performs basic string matching and confidence checks. To provide "deep" warnings, we are moving to a **Rule-Chain Verdict System** that correlates multiple risk signals (heuristics) to detect complex threats like Rug-pulls, MEV targets, and Honeypots.

## 2. Architecture: Rule-Chain Logic
Instead of a linear scoring model, the engine will execute a series of independent "Rule Handlers". Each handler inspects a specific aspect of the intent and its enriched context.

### 2.1 Execution Flow
1. **Input**: SIPIntent + RiskContext (Enriched data from Background).
2. **Rule Chain**:
   - BlacklistRule: Immediate block if address is known malicious.
   - AuthorityRule: Correlates Mint/Freeze permissions with token age/volume.
   - EconomicRule: Checks Price Impact and Slippage relative to liquidity.
   - TrustRule: Correlates verification status with social source (e.g., x.com).
3. **Verdict**: Aggregate results into a final SecurityReport.

## 3. Data Structures (Rust & TS Parity)

### 3.1 RiskContext (Enriched Data)
Background script will fetch this data before calling Wasm:
`ust
pub struct RiskContext {
    pub mint_authority: Option<String>,
    pub freeze_authority: Option<String>,
    pub is_jup_verified: bool,
    pub liquidity_usd: f64,
    pub token_created_at: Option<i64>, // Unix timestamp
}
`

### 3.2 Enhanced Heuristics
| Pattern Name | Logic Condition | Severity |
| :--- | :--- | :--- |
| **Rug Potential** | mint_auth.is_some() && liquidity < 5000 && !is_jup_verified | CRITICAL |
| **Honeypot Warning** | reeze_auth.is_some() && !is_jup_verified | HIGH |
| **MEV Exposure** | slippage_bps > 500 && mount > 1000 USD | MEDIUM |
| **Source Mismatch** | source == "x.com" && !is_jup_verified | WARN |

## 4. Scoring Logic
- **Base Score**: 100.
- **Blocking**: Any CRITICAL rule hit sets locking = true and score = 0.
- **Deductions**:
  - HIGH: -50 points.
  - MEDIUM: -30 points.
  - WARN: -10 points.

## 5. Implementation Steps
1. **Rust Core**: Update SIPIntent struct and implement Rule trait.
2. **Background**: Implement Helius/Jupiter enrichment logic to fill RiskContext.
3. **Bridge**: Update wasm-risk-engine.ts to pass the enriched context.

