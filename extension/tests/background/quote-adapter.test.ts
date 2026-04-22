import { describe, expect, it, vi } from "vitest";
import {
  createDefaultQuoteAdapter,
  createJupiterQuoteAdapter,
  type QuoteAdapter
} from "../../src/background/quote-adapter";
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
    platform: "Jupiter",
    userPublicKey: "FTp1BybZ51NiZKbnZH6MsrV3tUZNauhpQMbBcqYUEr5f"
  },
  metadata: {
    reasoning: "Swap to USDC",
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

describe("default quote adapter", () => {
  it("maps a Jupiter quote response into an Order result", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inAmount: "1000000000",
        outAmount: "250000000",
        transaction: "real-tx-data"
      })
    });

    const adapter = createDefaultQuoteAdapter({ fetchImpl });
    const result = await adapter.getOrder(validIntent);

    expect(result.quote.inAmount).toBe("1000000000");
    expect(result.quote.outAmount).toBe("250000000");
    expect(result.swapTransaction).toBe("real-tx-data");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws an error when Jupiter fetch fails and no fallback is provided", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const adapter = createDefaultQuoteAdapter({ fetchImpl });

    await expect(adapter.getOrder(validIntent)).rejects.toThrow("network down");
  });

  it("falls back to a custom adapter when Jupiter returns unusable data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: "invalid" })
    });
    const fallbackAdapter: QuoteAdapter = {
      getOrder: vi.fn().mockResolvedValue({
        quote: { inAmount: "1", outAmount: "2" },
        swapTransaction: "fallback-tx"
      }),
      executeSwap: vi.fn()
    };

    const adapter = createDefaultQuoteAdapter({ fetchImpl, fallbackAdapter });
    const result = await adapter.getOrder(validIntent);

    expect(result.swapTransaction).toBe("fallback-tx");
    expect(fallbackAdapter.getOrder).toHaveBeenCalledWith(validIntent);
  });
});
