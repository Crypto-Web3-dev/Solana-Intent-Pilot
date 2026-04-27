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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct IntentMetadata {
    pub reasoning: String,
    #[serde(rename = "requiresRiskScan")]
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
    pub mode: String,
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

#[wasm_bindgen]
pub fn scan_risk(intent_json: &str) -> String {
    let intent: SIPIntent = match serde_json::from_str(intent_json) {
        Ok(i) => i,
        Err(e) => return format!("{{\"error\": \"Invalid intent JSON: {:?}\"}}", e),
    };

    let rules: Vec<Box<dyn RiskRule>> = vec![
        Box::new(BlacklistRule),
        Box::new(AuthorityRule),
        Box::new(EconomicRule),
    ];

    let mut checks = Vec::new();
    let mut blocking = false;
    let mut score = 100;

    for rule in rules {
        if let Some(check) = rule.check(&intent) {
            if check.status == "fail" {
                blocking = true;
                score = 0;
            } else if check.status == "warn" {
                score = std::cmp::max(0, score - 30);
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

    let level = if blocking {
        "high"
    } else if score < 70 {
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
