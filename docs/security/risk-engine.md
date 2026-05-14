# SIP Risk Engine Design

## 1. Purpose

The SIP risk engine provides browser-local rule-based security checks before transaction execution, reducing the risk of delegating safety judgments entirely to cloud models.

The MVP focus is not a complete audit system, but rapid identification of high-risk tokens and obvious anomaly states using deterministic rules in Wasm, with a policy-based fallback.

## 2. Design Principles

- The risk engine runs primarily in a local Wasm environment with a policy-based fallback
- Output structure must be simple, stable, and directly consumable by UI
- High risk should block by default, avoiding "problems detected but no warning shown"
- Scoring logic prioritizes clear explainability over complex models
- Page allowlist validation precedes risk evaluation: if the current page is not in `SUPPORTED_PAGE_MATCHES`, the risk engine is not invoked and the system directly enters `blocked` + `unsupported-page` state
- Wasm is loaded lazily; if unavailable, `policy-fallback` provides baseline checks

## 3. Input & Output

### 3.1 Input

- `SIPIntent` (JSON-serialized) passed to `scan_risk()`
- The intent includes `riskContext` with on-chain data: mintAuthority, freezeAuthority, liquidityUsd, isJupVerified, tokenAgeHours
- On-chain data is enriched before Wasm invocation by `token-context-enricher.ts` using Jupiter API + Helius RPC

### 3.2 Output

```ts
type RiskLevel = "low" | "medium" | "high" | "unknown";
type RiskEngineSource = "wasm" | "policy-fallback";

interface SecurityCheck {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

interface SecurityReport {
  source: RiskEngineSource;
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: SecurityCheck[];
  summary: string;
}
```

## 4. Wasm Risk Rules

The Rust Wasm module (`risk-engine/src/lib.rs`) exports `scan_risk(intent_json: &str) -> String` and implements 5 rules:

### 4.1 BlacklistRule

- Checks if outputMint contains "blocked"
- Status: `fail`

### 4.2 AuthorityRule

Two sub-checks:

- **rug-potential** (`fail`): active mint authority + low liquidity + unverified token
- **honeypot-warning** (`warn`): freeze authority + unverified token

### 4.3 EconomicRule

- **high-slippage** (`warn`): slippageBps > 500

### 4.4 TrustRule

- **unverified-low-liquidity** (`warn`): unverified token with low liquidity
- **unverified-liquidity-unknown** (`warn`): unverified token with unknown liquidity

### 4.5 LifecycleRule

- **fresh-token** (`warn`): token age < 24 hours + unverified

## 5. Scoring

Simple rule-based model:

- Starting score: `100`
- `fail` result: score set to `0`
- `warn` result: score reduced by `35`
- Multiple warnings stack: each subtracts `35`
- Missing risk context: `level: "unknown"`, `score: 0`

Level thresholds:

- `80-100`: `low`
- `45-79`: `medium`
- `<45` or any `fail`: `high`
- Critical data missing: `unknown`

**Current implementation note**: The Wasm `blocking` field is hardcoded to `false`. Actual blocking decisions are made by the risk adapter layer (`risk-adapter.ts`) which applies policy rules on top of the Wasm output.

## 6. Policy Fallback

When Wasm is unavailable (e.g. test environment, load failure), `createPolicyRiskAdapter()` provides baseline checks:

- Checks mint authority and freeze authority presence
- Checks token verification status
- Marks incomplete data as `unknown`
- Source: `"policy-fallback"`

## 7. Risk Adapter Architecture

`risk-adapter.ts` orchestrates the full risk evaluation:

1. Enriches intent with live on-chain data via `fetchTokenSecurity()` (Jupiter API + Helius RPC)
2. Tries Wasm engine first via `loadDefaultWasmRiskEngine()`
3. Falls back to policy-based `buildPolicyReport()` if Wasm unavailable
4. If Wasm returns baseline pass without live data, `markInsufficientRiskData()` upgrades to `level: "unknown"`

## 8. Rust Module Boundary

```rust
#[wasm_bindgen]
pub fn scan_risk(intent_json: &str) -> String;
```

Rust is responsible for:

- Receiving intent JSON and parsing risk context
- Running rule checks against on-chain metadata
- Computing risk scores and returning structured reports

JS/TS is responsible for:

- Fetching on-chain data and enriching the intent
- Loading and instantiating the Wasm module
- Interpreting `SecurityReport` for UI and workflow decisions

## 9. UI Mapping

- `low`: green shield, proceed normally
- `medium`: yellow notice, proceed but risk must be clearly communicated
- `high`: red warning, block by default
- `unknown`: neutral or yellow notice, must not be disguised as a passed check

Action Card should decide based on `blocking`:

- Disable primary CTA
- MVP only shows cancel or back by default; high-risk override not enabled
- Highlight the specific failed check item

## 10. Future Extensions

- Make Wasm `blocking` field dynamic based on rule outcomes rather than hardcoded
- Add `simulateTransaction` balance diff risk explanation
- Introduce protocol-level blacklists or reputation lists
- Connect multi-source liquidity and holder data
- Use different risk strategies per intent type
