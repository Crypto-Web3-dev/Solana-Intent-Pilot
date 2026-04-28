use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RiskContext {
    pub mint_authority: Option<String>,
    pub freeze_authority: Option<String>,
    pub is_jup_verified: bool,
    pub liquidity_usd: f64,
    pub token_created_at: Option<i64>,
    #[serde(default)]
    pub token_age_hours: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IntentMetadata {
    #[serde(default)]
    pub reasoning: String,
    #[serde(rename = "requiresRiskScan", default)]
    pub requires_risk_scan: bool,
    #[serde(rename = "riskContext")]
    pub risk_context: Option<RiskContext>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SIPAction {
    pub id: String,
    #[serde(rename = "type")]
    pub action_type: String,
    pub payload: serde_json::Value,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SIPIntent {
    #[serde(rename = "intentId")]
    pub intent_id: String,
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub actions: Vec<SIPAction>,
    pub metadata: IntentMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct SecurityReport {
    pub source: String,
    pub score: i32,
    pub level: String,
    pub blocking: bool,
    pub summary: String,
    pub checks: Vec<SecurityCheck>,
}

#[derive(Serialize, Deserialize)]
pub struct SecurityCheck {
    pub key: String,
    pub label: String,
    pub status: String,
    pub detail: String,
}

trait RiskRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck>;
}

fn warning_check(key: &str, label: &str, detail: &str) -> SecurityCheck {
    SecurityCheck {
        key: key.to_string(),
        label: label.to_string(),
        status: "warn".to_string(),
        detail: detail.to_string(),
    }
}

struct BlacklistRule;
impl RiskRule for BlacklistRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck> {
        for action in &intent.actions {
            if let Some(out_mint) = action.payload.get("outputMint").and_then(|v| v.as_str()) {
                if out_mint.to_lowercase().contains("blocked") {
                    return Some(SecurityCheck {
                        key: "blacklist".to_string(),
                        label: "Blacklist Match".to_string(),
                        status: "fail".to_string(),
                        detail: format!("Token {} is on the known blacklist.", out_mint),
                    });
                }
            }
        }
        None
    }
}

struct AuthorityRule;
impl RiskRule for AuthorityRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck> {
        if let Some(ctx) = &intent.metadata.risk_context {
            // Pattern: Rug Potential
            if ctx.mint_authority.is_some() && ctx.liquidity_usd < 5000.0 && !ctx.is_jup_verified {
                return Some(SecurityCheck {
                    key: "rug-potential".to_string(),
                    label: "Rug Potential".to_string(),
                    status: "fail".to_string(),
                    detail: "Mint authority is active on a low-liquidity, unverified token.".to_string(),
                });
            }
            // Pattern: Honeypot Warning
            if ctx.freeze_authority.is_some() && !ctx.is_jup_verified {
                return Some(SecurityCheck {
                    key: "honeypot-warning".to_string(),
                    label: "Honeypot Risk".to_string(),
                    status: "warn".to_string(),
                    detail: "Freeze authority is enabled on an unverified token.".to_string(),
                });
            }
        }
        None
    }
}

struct EconomicRule;
impl RiskRule for EconomicRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck> {
        for action in &intent.actions {
            if let Some(slippage) = action.payload.get("slippageBps").and_then(|v| v.as_i64()) {
                if slippage > 500 {
                    return Some(SecurityCheck {
                        key: "high-slippage".to_string(),
                        label: "High Slippage".to_string(),
                        status: "warn".to_string(),
                        detail: format!("Slippage is set to {} bps, which increases MEV risk.", slippage),
                    });
                }
            }
        }
        None
    }
}

struct TrustRule;
impl RiskRule for TrustRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck> {
        if let Some(ctx) = &intent.metadata.risk_context {
            if !ctx.is_jup_verified && ctx.liquidity_usd < 5000.0 {
                return Some(warning_check(
                    "unverified-low-liquidity",
                    "Unverified Low Liquidity",
                    "Token is unverified and has low visible liquidity."
                ));
            }

            if !ctx.is_jup_verified && ctx.liquidity_usd <= 0.0 {
                return Some(warning_check(
                    "unverified-liquidity-unknown",
                    "Unverified Liquidity Unknown",
                    "Token is unverified and liquidity data is unavailable."
                ));
            }
        }

        None
    }
}

struct LifecycleRule;
impl RiskRule for LifecycleRule {
    fn check(&self, intent: &SIPIntent) -> Option<SecurityCheck> {
        if let Some(ctx) = &intent.metadata.risk_context {
            if !ctx.is_jup_verified && ctx.token_age_hours.is_some_and(|hours| hours < 24.0) {
                return Some(warning_check(
                    "fresh-token",
                    "Fresh Token",
                    "Token appears to be less than 24 hours old and is not Jupiter verified."
                ));
            }
        }

        None
    }
}

fn missing_risk_context_report() -> SecurityReport {
    SecurityReport {
        source: "wasm-core".to_string(),
        score: 0,
        level: "unknown".to_string(),
        blocking: false,
        summary: "Risk data incomplete".to_string(),
        checks: vec![warning_check(
            "risk-data-missing",
            "Risk Data",
            "Token authority, verification, and liquidity context was unavailable."
        )],
    }
}

#[wasm_bindgen]
pub fn scan_risk(intent_json: &str) -> String {
    let intent: SIPIntent = match serde_json::from_str(intent_json) {
        Ok(i) => i,
        Err(e) => return format!("{{\"error\": \"Invalid intent JSON: {:?}\"}}", e),
    };

    if intent.metadata.risk_context.is_none() {
        return serde_json::to_string(&missing_risk_context_report())
            .unwrap_or_else(|_| "{\"error\": \"Failed to serialize report\"}".to_string());
    }

    let rules: Vec<Box<dyn RiskRule>> = vec![
        Box::new(BlacklistRule),
        Box::new(AuthorityRule),
        Box::new(EconomicRule),
        Box::new(TrustRule),
        Box::new(LifecycleRule),
    ];

    let mut checks = Vec::new();
    let blocking = false;
    let mut score = 100;

    for rule in rules {
        if let Some(check) = rule.check(&intent) {
            if check.status == "fail" {
                score = 0;
            } else if check.status == "warn" {
                score = std::cmp::max(0, score - 35);
            }
            checks.push(check);
        }
    }

    if checks.is_empty() {
        checks.push(SecurityCheck {
            key: "baseline".to_string(),
            label: "Safe Baseline".to_string(),
            status: "pass".to_string(),
            detail: "No complex risk patterns detected.".to_string(),
        });
    }

    let level = if score < 50 {
        "high"
    } else if score <= 70 {
        "medium"
    } else {
        "low"
    };

    let report = SecurityReport {
        source: "wasm-core".to_string(),
        score,
        level: level.to_string(),
        blocking,
        summary: if blocking { "Risk Blocked".to_string() } else { "Scan Completed".to_string() },
        checks,
    };

    serde_json::to_string(&report).unwrap_or_else(|_| "{\"error\": \"Failed to serialize report\"}".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn scan(payload: serde_json::Value) -> SecurityReport {
        let report = scan_risk(&payload.to_string());
        serde_json::from_str(&report).expect("risk report json")
    }

    fn swap_with_context(risk_context: serde_json::Value) -> serde_json::Value {
        json!({
            "intentId": "test-intent",
            "mode": "SINGLE",
            "actions": [
                {
                    "id": "action-1",
                    "type": "SWAP",
                    "status": "pending",
                    "payload": {
                        "inputMint": "So11111111111111111111111111111111111111112",
                        "outputMint": "2VuEj1YCQXknpBKPonqBxUCfqvHSJ21FgF5qSgQEpump",
                        "amount": "1000000000",
                        "amountMode": "exact",
                        "slippageBps": 50,
                        "platform": "Jupiter"
                    }
                }
            ],
            "metadata": {
                "strategyGoal": "Buy pump.fun token",
                "reasoning": "Test",
                "jitoTipLamports": 0,
                "requiresRiskScan": true,
                "sourceContext": ["page-token"],
                "needsClarification": false,
                "riskContext": risk_context
            }
        })
    }

    #[test]
    fn warns_for_unverified_low_liquidity_token_even_without_active_authorities() {
        let report = scan(swap_with_context(json!({
            "mintAuthority": null,
            "freezeAuthority": null,
            "isJupVerified": false,
            "liquidityUsd": 1200.0,
            "tokenAgeHours": 72.0
        })));

        assert_eq!(report.blocking, false);
        assert_eq!(report.level, "medium");
        assert!(report.score < 100);
        assert!(report.checks.iter().any(|check| check.key == "unverified-low-liquidity"));
    }

    #[test]
    fn warns_for_fresh_pump_fun_style_tokens() {
        let report = scan(swap_with_context(json!({
            "mintAuthority": null,
            "freezeAuthority": null,
            "isJupVerified": false,
            "liquidityUsd": 25000.0,
            "tokenAgeHours": 2.0
        })));

        assert_eq!(report.level, "medium");
        assert!(report.score < 100);
        assert!(report.checks.iter().any(|check| check.key == "fresh-token"));
    }

    #[test]
    fn marks_missing_risk_context_as_unknown_not_safe_baseline() {
        let report = scan(json!({
            "intentId": "test-intent",
            "mode": "SINGLE",
            "actions": [],
            "metadata": {
                "strategyGoal": "Buy token",
                "reasoning": "Test",
                "jitoTipLamports": 0,
                "requiresRiskScan": true,
                "sourceContext": [],
                "needsClarification": false
            }
        }));

        assert_eq!(report.level, "unknown");
        assert_eq!(report.score, 0);
        assert_eq!(report.blocking, false);
        assert!(report.checks.iter().any(|check| check.key == "risk-data-missing"));
    }

    #[test]
    fn reports_high_risk_without_directly_blocking_execution() {
        let report = scan(swap_with_context(json!({
            "mintAuthority": "active",
            "freezeAuthority": null,
            "isJupVerified": false,
            "liquidityUsd": 100.0,
            "tokenAgeHours": 1.0
        })));

        assert_eq!(report.level, "high");
        assert_eq!(report.score, 0);
        assert_eq!(report.blocking, false);
        assert!(report.checks.iter().any(|check| check.key == "rug-potential"));
    }
}
