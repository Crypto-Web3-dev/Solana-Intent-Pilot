import { describe, expect, it, vi } from "vitest";
import { createPolicyPreviewAdapter } from "../../src/background/preview-adapter";
import type { QuoteAdapter } from "../../src/background/quote-adapter";
import type { SimulationAdapter } from "../../src/background/simulation-adapter";
import type { SIPIntent } from "../../src/shared/intent";

const validIntent: SIPIntent = {
  intentId: "test-intent-id",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      status: "pending",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      }
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap to USDC",
    reasoning: "Swap to USDC",
    estimatedNetChange: { spend: "1 SOL", receive: "100 USDC" },
    jitoTipLamports: 1000,
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

describe("policy preview adapter", () => {
  it("combines live quote and live simulation results into one preview", async () => {
    const quoteAdapter: QuoteAdapter = {
      getOrder: vi.fn().mockResolvedValue({
        quote: {
          inAmount: "1000000000",
          outAmount: "250000000",
          feeAmount: "5000"
        },
        swapTransaction: "real-tx-payload"
      }),
      executeSwap: vi.fn()
    };
    const simulationAdapter: SimulationAdapter = {
      simulate: vi.fn().mockResolvedValue({
        simulationSummary: "RPC preflight ready at slot 123456",
        success: true
      })
    };

    const adapter = createPolicyPreviewAdapter({
      quoteAdapter,
      simulationAdapter
    });

    const preview = await adapter.buildPreview("req-preview", validIntent);

    expect(preview.requestId).toBe("req-preview");
    expect(preview.routeLabel).toBe("Jupiter Swap");
    expect(preview.outputAmount).toBe("250000000");
    expect(preview.swapTransaction).toBe("real-tx-payload");
    expect(preview.simulationSummary).toBe("RPC preflight ready at slot 123456");
  });

  it("throws when simulation does not produce a signable result", async () => {
    const quoteAdapter: QuoteAdapter = {
      getOrder: vi.fn().mockResolvedValue({
        quote: {
          inAmount: "1000000000",
          outAmount: "250000000",
          signatureFeeLamports: "5000"
        },
        swapTransaction: "real-tx-payload"
      }),
      executeSwap: vi.fn()
    };
    const simulationAdapter: SimulationAdapter = {
      simulate: vi.fn().mockResolvedValue({
        simulationSummary: "Simulation provider is not configured.",
        success: false,
        error: "simulation-provider-missing"
      })
    };

    const adapter = createPolicyPreviewAdapter({
      quoteAdapter,
      simulationAdapter
    });

    await expect(adapter.buildPreview("req-preview-fail", validIntent)).rejects.toThrow(
      "simulation-provider-missing"
    );
  });
});
