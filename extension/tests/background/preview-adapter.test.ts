import { describe, expect, it, vi } from "vitest";
import { createPolicyPreviewAdapter } from "../../src/background/preview-adapter";
import type { QuoteAdapter } from "../../src/background/quote-adapter";
import type { SimulationAdapter } from "../../src/background/simulation-adapter";
import type { SIPIntent } from "../../src/shared/intent";

const validIntent: SIPIntent = {
  intent: "SWAP",
  confidence: 0.92,
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000000",
    amountMode: "exact",
    slippageBps: 50,
    platform: "Jupiter"
  },
  metadata: {
    reasoning: "Swap to USDC",
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

describe("policy preview adapter", () => {
  it("combines live quote and live simulation results into one preview", async () => {
    const quoteAdapter: QuoteAdapter = {
      getQuote: vi.fn().mockResolvedValue({
        routeLabel: "Jupiter",
        inputAmount: "1000000000",
        outputAmount: "250000000",
        slippageBps: 50,
        estimatedFeeLamports: "5000"
      })
    };
    const simulationAdapter: SimulationAdapter = {
      simulate: vi.fn().mockResolvedValue({
        simulationSummary: "RPC preflight ready at slot 123456"
      })
    };

    const adapter = createPolicyPreviewAdapter({
      quoteAdapter,
      simulationAdapter
    });

    const preview = await adapter.buildPreview("req-preview", validIntent);

    expect(preview.requestId).toBe("req-preview");
    expect(preview.routeLabel).toBe("Jupiter");
    expect(preview.outputAmount).toBe("250000000");
    expect(preview.simulationSummary).toBe("RPC preflight ready at slot 123456");
  });
});
