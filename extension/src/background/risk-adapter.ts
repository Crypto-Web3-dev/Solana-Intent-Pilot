import type { SIPIntent } from "../shared/intent";
import type {
  RiskEngineSource,
  SecurityCheck,
  SecurityReport
} from "../shared/risk";
import { mockRiskScan } from "./mock-services";
import {
  type WasmRiskEngine,
  loadDefaultWasmRiskEngine
} from "./wasm-risk-engine";

export interface RiskAdapter {
  scanRisk(intent: SIPIntent): Promise<SecurityReport>;
}

export interface RiskAdapterDependencies {
  loadWasmRiskEngine?: () => Promise<WasmRiskEngine | null>;
}

function createSecurityCheck(
  key: string,
  label: string,
  status: SecurityCheck["status"],
  detail: string
): SecurityCheck {
  return {
    key,
    label,
    status,
    detail
  };
}

function buildPolicyReport(intent: SIPIntent): SecurityReport {
  const checks: SecurityCheck[] = [];
  let blocking = false;
  let level: SecurityReport["level"] = "low";

  const outputMint = intent.payload.outputMint.trim();
  const hasOutputMint = outputMint.length > 0;
  const hasBlockedMarker = outputMint.includes("blocked");
  const confidence = intent.confidence;
  const needsClarification = intent.metadata.needsClarification;
  const requiresRiskScan = intent.metadata.requiresRiskScan;

  if (!hasOutputMint) {
    blocking = true;
    level = "high";
    checks.push(
      createSecurityCheck(
        "output-mint",
        "Output Mint",
        "fail",
        "Output mint is missing or invalid"
      )
    );
  }

  if (hasBlockedMarker) {
    blocking = true;
    level = "high";
    checks.push(
      createSecurityCheck(
        "mint-authority",
        "Mint Authority",
        "fail",
        "Blocked token exposes mint authority"
      )
    );
  }

  if (intent.payload.platform.toLowerCase() === "wallet") {
    checks.push(
      createSecurityCheck(
        "transfer-intent",
        "Transfer Intent",
        "warn",
        "Transfer-like flows are not part of the current swap execution path"
      )
    );
    level = blocking ? "high" : "medium";
  }

  if (confidence < 0.5 && needsClarification) {
    checks.push(
      createSecurityCheck(
        "clarification-needed",
        "Clarification Needed",
        "warn",
        "Intent confidence is low and user clarification is still required"
      )
    );
    level = blocking ? "high" : "medium";
  } else if (confidence < 0.85 && !blocking) {
    checks.push(
      createSecurityCheck(
        "confidence-low",
        "Confidence",
        "warn",
        "Model confidence is below the preferred operating threshold"
      )
    );
    level = "medium";
  }

  if (!requiresRiskScan && !blocking) {
    checks.push(
      createSecurityCheck(
        "risk-scan-skipped",
        "Risk Scan",
        "warn",
        "Intent does not require a full risk scan in the current flow"
      )
    );
  }

  if (!checks.length) {
    checks.push(
      createSecurityCheck(
        "baseline-check",
        "Baseline Check",
        "pass",
        "No obvious risk signals were detected"
      )
    );
  }

  const score = blocking ? 10 : level === "medium" ? 60 : 90;
  const summary = blocking
    ? "Blocked by policy checks"
    : level === "medium"
      ? "Policy checks returned warnings"
      : "Policy checks passed";

  return {
    source: "policy-fallback",
    score,
    level,
    blocking,
    checks,
    summary
  };
}

export function createPolicyRiskAdapter(): RiskAdapter {
  return {
    scanRisk(intent: SIPIntent): Promise<SecurityReport> {
      return Promise.resolve(buildPolicyReport(intent));
    }
  };
}

export function createMockRiskAdapter(): RiskAdapter {
  return {
    scanRisk: mockRiskScan
  };
}

function isValidSecurityReport(report: SecurityReport | null): report is SecurityReport {
  return report !== null && typeof report.source === "string";
}

async function resolveWasmRiskEngine(
  dependencies: RiskAdapterDependencies
): Promise<WasmRiskEngine | null> {
  if (dependencies.loadWasmRiskEngine) {
    return dependencies.loadWasmRiskEngine();
  }

  return loadDefaultWasmRiskEngine();
}

export function createDefaultRiskAdapter(
  dependencies: RiskAdapterDependencies = {}
): RiskAdapter {
  return {
    async scanRisk(intent: SIPIntent): Promise<SecurityReport> {
      const wasmEngine = await resolveWasmRiskEngine(dependencies);

      if (wasmEngine) {
        try {
          const wasmReport = await wasmEngine.scanRisk(intent);
          if (isValidSecurityReport(wasmReport)) {
            return {
              ...wasmReport,
              source: "wasm" satisfies RiskEngineSource
            };
          }
        } catch {
          // Fall back to policy when the Wasm engine cannot produce a valid report.
        }
      }

      return buildPolicyReport(intent);
    }
  };
}
