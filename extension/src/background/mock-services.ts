import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

function createMockSwapIntent(options?: {
  needsClarification?: boolean;
  requiresRiskScan?: boolean;
  outputMint?: string;
  confidence?: number;
}): SIPIntent {
  return {
    intent: "SWAP",
    confidence: options?.confidence ?? 0.92,
    payload: {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint:
        options?.outputMint ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: options?.needsClarification ? "0" : "1000000000",
      amountMode: "exact",
      slippageBps: 50,
      platform: "Jupiter"
    },
    metadata: {
      reasoning: options?.needsClarification ? "Need clarification" : "Swap to USDC",
      requiresRiskScan: options?.requiresRiskScan ?? true,
      sourceContext: ["page-token"],
      needsClarification: options?.needsClarification ?? false
    }
  };
}

function createMockTransferIntent(): SIPIntent {
  return {
    intent: "TRANSFER",
    confidence: 0.72,
    payload: {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "So11111111111111111111111111111111111111112",
      amount: "1000000000",
      amountMode: "exact",
      slippageBps: 0,
      platform: "Wallet"
    },
    metadata: {
      reasoning: "Transfer intent for router coverage",
      requiresRiskScan: false,
      sourceContext: ["page-token"],
      needsClarification: false
    }
  };
}

export async function mockParseIntent(input: string): Promise<SIPIntent> {
  if (input.includes("parse-fail")) {
    throw new Error("Intent parse failed");
  }

  if (input.includes("risk-fail")) {
    return createMockSwapIntent({
      outputMint: "risk-fail-mint-address",
      requiresRiskScan: true
    });
  }

  if (input.includes("preview-fail")) {
    return createMockSwapIntent({
      outputMint: "preview-fail-mint-address",
      requiresRiskScan: true
    });
  }

  if (input.includes("transfer")) {
    return createMockTransferIntent();
  }

  if (input.includes("unclear")) {
    return createMockSwapIntent({
      confidence: 0.3,
      needsClarification: true,
      requiresRiskScan: false
    });
  }

  return createMockSwapIntent({
    outputMint: input.includes("blocked")
      ? "blocked-mint-address"
      : undefined,
    requiresRiskScan: input.includes("blocked") || !input.includes("direct")
  });
}

export async function mockRiskScan(intent: SIPIntent): Promise<SecurityReport> {
  if (intent.payload.outputMint.includes("risk-fail")) {
    throw new Error("Risk scan unavailable");
  }

  if (intent.payload.outputMint.includes("blocked")) {
    return {
      source: "policy-fallback",
      score: 10,
      level: "high",
      blocking: true,
      checks: [
        {
          key: "mint-authority",
          label: "Mint Authority",
          status: "fail",
          detail: "Blocked token exposes mint authority"
        }
      ],
      summary: "Blocked token"
    };
  }

  return {
    source: "policy-fallback",
    score: 90,
    level: "low",
    blocking: false,
    checks: [],
    summary: "Safe enough for demo"
  };
}

export async function mockExecutionPreview(
  requestId: string
): Promise<ExecutionPreview> {
  if (requestId.includes("preview-fail")) {
    throw new Error("Preview generation failed");
  }

  return {
    requestId,
    routeLabel: "Jupiter",
    inputAmount: "1 SOL",
    outputAmount: "100 USDC",
    slippageBps: 50,
    estimatedFeeLamports: "5000",
    simulationSummary: "Mock simulation passed"
  };
}
