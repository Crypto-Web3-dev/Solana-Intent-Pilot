use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct SIPIntent {
    pub intent: String,
    pub confidence: f64,
    pub payload: IntentPayload,
    pub metadata: IntentMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct IntentPayload {
    #[serde(rename = "inputMint")]
    pub input_mint: String,
    #[serde(rename = "outputMint")]
    pub output_mint: String,
    pub amount: String,
    pub platform: String,
}

#[derive(Serialize, Deserialize)]
pub struct IntentMetadata {
    pub reasoning: String,
    #[serde(rename = "requiresRiskScan")]
    pub requires_risk_scan: bool,
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

#[wasm_bindgen]
pub fn scan_risk(intent_json: &str) -> String {
    let intent: SIPIntent = match serde_json::from_str(intent_json) {
        Ok(i) => i,
        Err(_) => return "{\"error\": \"Invalid intent JSON\"}".to_string(),
    };

    let mut checks = Vec::new();
    let mut blocking = false;
    let mut score = 100;

    // 规则 1: 黑名单 Mint 检查
    if intent.payload.output_mint.to_lowercase().contains("blocked") {
        blocking = true;
        score -= 90;
        checks.push(SecurityCheck {
            key: "malicious-mint".to_string(),
            label: "Malicious Mint".to_string(),
            status: "fail".to_string(),
            detail: "The output mint address is explicitly flagged as malicious.".to_string(),
        });
    }

    // 规则 2: 置信度检查
    if intent.confidence < 0.85 {
        score -= 30;
        checks.push(SecurityCheck {
            key: "low-confidence".to_string(),
            label: "Low AI Confidence".to_string(),
            status: "warn".to_string(),
            detail: format!("The AI parsing confidence ({:.2}) is below the safe threshold of 0.85.", intent.confidence),
        });
    }

    // 规则 3: 非法平台检查
    if intent.payload.platform == "Unknown" {
        score -= 20;
        checks.push(SecurityCheck {
            key: "unknown-platform".to_string(),
            label: "Unknown Platform".to_string(),
            status: "warn".to_string(),
            detail: "The trading platform could not be identified.".to_string(),
        });
    }

    if checks.is_empty() {
        checks.push(SecurityCheck {
            key: "baseline".to_string(),
            label: "Baseline Check".to_string(),
            status: "pass".to_string(),
            detail: "No obvious risk signals were detected by the Wasm engine.".to_string(),
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
