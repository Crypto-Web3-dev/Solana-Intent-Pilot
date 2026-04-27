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

  // Use optional chaining and focus on the first action for policy fallback
  const firstAction = intent.actions?.[0];
  const outputMint = firstAction?.payload?.outputMint?.trim() || "";
  const platform = firstAction?.payload?.platform?.toLowerCase() || "";
  
  const hasOutputMint = outputMint.length > 0;
  const hasBlockedMarker = outputMint.includes("blocked");
  
  const needsClarification = intent.metadata?.needsClarification || false;
  const requiresRiskScan = intent.metadata?.requiresRiskScan || false;

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

  if (platform === "wallet") {
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

  if (needsClarification) {
    checks.push(
      createSecurityCheck(
        "clarification-needed",
        "Clarification Needed",
        "warn",
        "User clarification is still required for this intent"
      )
    );
    level = blocking ? "high" : "medium";
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

async function fetchTokenSecurity(mint: string) {
  const HELIUS_KEY = process.env.HELIUS_API_KEY;
  const JUP_KEY = process.env.JUPITER_API_KEY;

  try {
    // 1. Fetch Authority via Helius (getAccountInfo/getAsset)
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
    const accountResponse = await fetch(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "risk-check",
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }]
      })
    });
    const accountData = await accountResponse.json();
    const parsedData = accountData.result?.value?.data?.parsed?.info;

    // 2. Fetch Verification Status via Jupiter
    // We check against Jupiter's strict list or verified tokens
    const jupUrl = `https://api.jup.ag/api/v1/token/${mint}`;
    const jupResponse = await fetch(jupUrl, {
      headers: { "x-api-key": JUP_KEY || "" }
    });
    const jupData = jupResponse.ok ? await jupResponse.json() : null;

    return {
      mintAuthority: parsedData?.mintAuthority || null,
      freezeAuthority: parsedData?.freezeAuthority || null,
      isJupVerified: !!jupData && jupData.tags?.includes("verified"),
      // For liquidity, we'd ideally fetch from Birdeye, but for now we'll 
      // use a heuristic or set a default if verified.
      liquidityUsd: jupData ? 1000000 : 0 
    };
  } catch (err) {
    console.error("[Risk Adapter] Failed to fetch live security data:", err);
    return null;
  }
}

async function enrichRiskContext(intent: SIPIntent): Promise<SIPIntent> {
  const firstAction = intent.actions?.[0];
  const outputMint = firstAction?.payload?.outputMint;

  if (!outputMint || outputMint === "So11111111111111111111111111111111111111112") {
    return intent;
  }

  console.log(`[Risk Adapter] Enriching context for mint: ${outputMint}`);
  const liveData = await fetchTokenSecurity(outputMint);

  if (!liveData) return intent;

  return {
    ...intent,
    metadata: {
      ...intent.metadata,
      riskContext: {
        mintAuthority: liveData.mintAuthority,
        freezeAuthority: liveData.freezeAuthority,
        isJupVerified: liveData.isJupVerified,
        liquidityUsd: liveData.liquidityUsd,
        tokenCreatedAt: Date.now() // Placeholder as creation time requires more complex indexing
      }
    }
  };
}

export function createDefaultRiskAdapter(
  dependencies: RiskAdapterDependencies = {}
): RiskAdapter {
  return {
    async scanRisk(intent: SIPIntent): Promise<SecurityReport> {
      // Reduce delay for better responsiveness and to avoid test timeouts
      await new Promise(resolve => setTimeout(resolve, 500));

      // Enrich intent with on-chain data before scanning
      const enrichedIntent = await enrichRiskContext(intent);

      const wasmEngine = await resolveWasmRiskEngine(dependencies);

      if (wasmEngine) {
        try {
          const wasmReport = await wasmEngine.scanRisk(enrichedIntent);
          if (isValidSecurityReport(wasmReport)) {
            return {
              ...wasmReport,
              source: "wasm" satisfies RiskEngineSource
            };
          }
        } catch (err) {
          console.error("[Risk Adapter] Wasm scan error:", err);
          // Fall back to policy
        }
      }

      return buildPolicyReport(intent);
    }
  };
}
