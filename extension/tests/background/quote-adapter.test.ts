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
    platform: "Jupiter"
  },
  metadata: {
    reasoning: "Swap to USDC",
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

describe("default quote adapter", () => {
  it("maps a Jupiter quote response into QuoteResult", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inAmount: "1000000000",
        outAmount: "250000000"
      })
    });

    const adapter = createDefaultQuoteAdapter({ fetchImpl });
    const result = await adapter.getQuote(validIntent);

    expect(result.routeLabel).toBe("Jupiter");
    expect(result.inputAmount).toBe("1000000000");
    expect(result.outputAmount).toBe("250000000");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the mock adapter when Jupiter fetch fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    const adapter = createDefaultQuoteAdapter({ fetchImpl });

    const result = await adapter.getQuote(validIntent);

    expect(result.routeLabel).toBe("Jupiter");
    expect(result.inputAmount).toBe("1 SOL");
    expect(result.outputAmount).toBe("100 USDC");
  });

  it("falls back to a custom adapter when Jupiter returns unusable data", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ outAmount: "250000000" })
    });
    const fallbackAdapter: QuoteAdapter = {
      getQuote: vi.fn().mockResolvedValue({
        routeLabel: "Fallback",
        inputAmount: "2 SOL",
        outputAmount: "200 USDC",
        slippageBps: 75,
        estimatedFeeLamports: "6000"
      })
    };

    const adapter = createDefaultQuoteAdapter({ fetchImpl, fallbackAdapter });
    const result = await adapter.getQuote(validIntent);

    expect(result.routeLabel).toBe("Fallback");
    expect(result.inputAmount).toBe("2 SOL");
    expect(result.outputAmount).toBe("200 USDC");
    expect(fallbackAdapter.getQuote).toHaveBeenCalledWith(validIntent);
  });

  it("fails live quote mapping when required amounts are missing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ inAmount: "1000000000" })
    });

    const adapter = createJupiterQuoteAdapter({ fetchImpl });

    await expect(adapter.getQuote(validIntent)).rejects.toThrow(
      "Jupiter quote response is missing required amounts"
    );
  });
});
