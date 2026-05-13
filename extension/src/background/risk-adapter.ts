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
  fetchImpl?: typeof fetch;
}

type JupiterTokenRiskMetadata = {
  isJupVerified: boolean;
  liquidityUsd: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  tokenCreatedAt?: number;
  tokenAgeHours?: number;
};

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

function hasMinimumRiskContext(intent: SIPIntent) {
  const context = intent.metadata.riskContext;
  return (
    !!context &&
    typeof context.isJupVerified === "boolean" &&
    typeof context.liquidityUsd === "number" &&
    "mintAuthority" in context &&
    "freezeAuthority" in context
  );
}

function isWasmBaselineReport(report: SecurityReport) {
  return (
    report.level === "low" &&
    !report.blocking &&
    report.checks.some((check) => check.key === "baseline" || check.key === "baseline-check")
  );
}

function markInsufficientRiskData(report: SecurityReport): SecurityReport {
  return {
    ...report,
    score: 0,
    level: "unknown",
    blocking: false,
    summary: "Risk data incomplete",
    checks: [
      {
        key: "minimum-risk-data",
        label: "Risk Data",
        status: "warn",
        detail: "Live token authority or verification data was unavailable; this is not a verified safe result."
      }
    ]
  };
}

async function resolveWasmRiskEngine(
  dependencies: RiskAdapterDependencies
): Promise<WasmRiskEngine | null> {
  if (dependencies.loadWasmRiskEngine) {
    return dependencies.loadWasmRiskEngine();
  }

  return loadDefaultWasmRiskEngine();
}

function getDefaultFetch() {
  return globalThis.fetch?.bind(globalThis);
}

function readAuthorityFromJupiterAudit(
  audit: any,
  key: "mintAuthorityDisabled" | "freezeAuthorityDisabled"
) {
  if (!audit || typeof audit[key] !== "boolean") return undefined;
  return audit[key] ? null : "active";
}

function readJupiterCreatedAt(token: any) {
  const createdAt = token?.createdAt ?? token?.firstPool?.createdAt;
  if (typeof createdAt !== "string") return undefined;

  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function calculateTokenAgeHours(createdAt?: number) {
  if (typeof createdAt !== "number") return undefined;

  return Math.max(0, (Date.now() - createdAt) / 3_600_000);
}

async function fetchJupiterTokenRiskMetadata(
  mint: string,
  fetchImpl: typeof fetch,
  apiKey?: string
): Promise<JupiterTokenRiskMetadata | null> {
  const response = await fetchImpl(
    `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`,
    {
      method: "GET",
      headers: apiKey ? { "x-api-key": apiKey } : undefined
    }
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const tokens = Array.isArray(payload) ? payload : [];
  const token = tokens.find(
    (candidate) =>
      candidate?.id === mint ||
      candidate?.address === mint ||
      candidate?.mint === mint
  );
  if (!token) return null;

  const tags = Array.isArray(token.tags) ? token.tags : [];

  const tokenCreatedAt = readJupiterCreatedAt(token);

  return {
    isJupVerified: token.isVerified === true || tags.includes("verified"),
    liquidityUsd: typeof token.liquidity === "number" ? token.liquidity : 0,
    mintAuthority: readAuthorityFromJupiterAudit(token.audit, "mintAuthorityDisabled"),
    freezeAuthority: readAuthorityFromJupiterAudit(token.audit, "freezeAuthorityDisabled"),
    tokenCreatedAt,
    tokenAgeHours: calculateTokenAgeHours(tokenCreatedAt)
  };
}

async function fetchTokenSecurity(mint: string, fetchImpl: typeof fetch = getDefaultFetch() as typeof fetch) {
  // Use PLASMO_PUBLIC_ prefix as required by Plasmo for environment variables
  const HELIUS_KEY = process.env.PLASMO_PUBLIC_HELIUS_API_KEY || process.env.HELIUS_API_KEY;
  const JUP_KEY = process.env.PLASMO_PUBLIC_JUPITER_API_KEY || process.env.JUPITER_API_KEY;

  if (!fetchImpl) {
    return null;
  }

  if (!HELIUS_KEY && !JUP_KEY) {
    console.warn("[Risk Adapter] Both API keys missing, using mock/fallback security state.");
    return null;
  }

  try {
    const jupiterData = await fetchJupiterTokenRiskMetadata(
      mint,
      fetchImpl,
      JUP_KEY
    ).catch(() => null);

    if (!HELIUS_KEY && !jupiterData) {
      console.warn("[Risk Adapter] HELIUS_API_KEY is missing and Jupiter token metadata was unavailable.");
      return null;
    }

    if (!HELIUS_KEY) {
      return jupiterData;
    }

    // 1. Fetch Authority via Helius
    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
    const accountResponse = await fetchImpl(heliusUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "risk-check",
        method: "getAccountInfo",
        params: [mint, { encoding: "jsonParsed" }]
      })
    });
    
    if (!accountResponse.ok) {
      throw new Error(`Helius RPC returned ${accountResponse.status}`);
    }

    const accountData = await accountResponse.json();
    const parsedData = accountData.result?.value?.data?.parsed?.info;

    return {
      mintAuthority:
        parsedData?.mintAuthority ??
        jupiterData?.mintAuthority ??
        undefined,
      freezeAuthority:
        parsedData?.freezeAuthority ??
        jupiterData?.freezeAuthority ??
        undefined,
      isJupVerified: jupiterData?.isJupVerified ?? false,
      liquidityUsd: jupiterData?.liquidityUsd ?? 0,
      tokenCreatedAt: jupiterData?.tokenCreatedAt,
      tokenAgeHours: jupiterData?.tokenAgeHours
    };
  } catch (err) {
    console.error("[Risk Adapter] Failed to fetch live security data:", err);
    return null;
  }
}

async function enrichRiskContext(
  intent: SIPIntent,
  fetchImpl?: typeof fetch
): Promise<SIPIntent> {
  const firstAction = intent.actions?.[0];
  const outputMint = firstAction?.payload?.outputMint;

  if (!outputMint || outputMint === "So11111111111111111111111111111111111111112") {
    return intent;
  }

  console.log(`[Risk Adapter] Enriching context for mint: ${outputMint}`);
  const liveData = await fetchTokenSecurity(outputMint, fetchImpl);

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
        tokenCreatedAt: liveData.tokenCreatedAt,
        tokenAgeHours: liveData.tokenAgeHours
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
      const enrichedIntent = await enrichRiskContext(
        intent,
        dependencies.fetchImpl ?? getDefaultFetch()
      );

      const wasmEngine = await resolveWasmRiskEngine(dependencies);

      if (wasmEngine) {
        try {
          const wasmReport = await wasmEngine.scanRisk(enrichedIntent);
          if (isValidSecurityReport(wasmReport)) {
            const report = {
              ...wasmReport,
              source: "wasm" satisfies RiskEngineSource
            };

            if (!hasMinimumRiskContext(enrichedIntent) && isWasmBaselineReport(report)) {
              return markInsufficientRiskData(report);
            }

            return {
              ...report
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
