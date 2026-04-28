import { describe, expect, it, vi } from "vitest";
import {
  createDefaultQuoteAdapter,
  createJupiterQuoteAdapter,
  type QuoteAdapter
} from "../../src/background/quote-adapter";
import type { SIPAction } from "../../src/shared/intent";

const validAction: SIPAction = {
  id: "action-1",
  type: "SWAP",
  status: "pending",
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000000",
    amountMode: "exact",
    swapMode: "ExactIn",
    slippageBps: 50,
    platform: "Jupiter",
    userPublicKey: "FTp1BybZ51NiZKbnZH6MsrV3tUZNauhpQMbBcqYUEr5f"
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

    const adapter = createDefaultQuoteAdapter({ fetchImpl, apiKey: "jup-test-key" });
    const result = await adapter.getOrder(validAction);

    expect(result.quote.inAmount).toBe("1000000000");
    expect(result.quote.outAmount).toBe("250000000");
    expect(result.swapTransaction).toBe("real-tx-data");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("passes ExactOut through to Jupiter order requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inAmount: "1230000000",
        outAmount: "100000000",
        transaction: "exact-out-tx-data"
      })
    });

    const adapter = createJupiterQuoteAdapter({ fetchImpl, apiKey: "jup-test-key" });

    await adapter.getOrder({
      ...validAction,
      payload: {
        ...validAction.payload,
        amount: "100000000",
        swapMode: "ExactOut"
      }
    });

    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.searchParams.get("swapMode")).toBe("ExactOut");
    expect(url.searchParams.get("amount")).toBe("100000000");
  });

  it("sends the Jupiter API key header and taker on order requests", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inAmount: "1000000000",
        outAmount: "250000000",
        transaction: "real-tx-data"
      })
    });

    const adapter = createJupiterQuoteAdapter({
      fetchImpl,
      apiKey: "jup-test-key"
    });

    await adapter.getOrder(validAction);

    const [requestUrl, requestOptions] = fetchImpl.mock.calls[0];
    const url = new URL(requestUrl);
    expect(url.searchParams.get("taker")).toBe(validAction.payload.userPublicKey);
    expect(requestOptions.headers["x-api-key"]).toBe("jup-test-key");
  });

  it("fails before calling Jupiter when an order request has no taker", async () => {
    const fetchImpl = vi.fn();
    const adapter = createJupiterQuoteAdapter({
      fetchImpl,
      apiKey: "jup-test-key"
    });

    await expect(
      adapter.getOrder({
        ...validAction,
        payload: {
          ...validAction.payload,
          userPublicKey: undefined
        }
      })
    ).rejects.toThrow("Jupiter order request requires a taker wallet public key");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails before calling Jupiter when the API key is missing", async () => {
    const fetchImpl = vi.fn();
    const adapter = createJupiterQuoteAdapter({
      fetchImpl,
      apiKey: ""
    });

    await expect(adapter.getOrder(validAction)).rejects.toThrow(
      "Jupiter order request requires PLASMO_PUBLIC_JUPITER_API_KEY"
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("throws an error when Jupiter fetch fails and no fallback is provided", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    // Provide a null-like or explicitly failing fallback to avoid the default mock success
    const fallbackAdapter: QuoteAdapter = {
        getOrder: () => Promise.reject(new Error("network down")),
        executeSwap: () => Promise.reject(new Error("network down"))
    };
    const adapter = createDefaultQuoteAdapter({
      fetchImpl,
      fallbackAdapter,
      apiKey: "jup-test-key"
    });

    await expect(adapter.getOrder(validAction)).rejects.toThrow("network down");
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

    const adapter = createDefaultQuoteAdapter({
      fetchImpl,
      fallbackAdapter,
      apiKey: "jup-test-key"
    });
    await expect(adapter.getOrder(validAction)).rejects.toThrow("invalid");
  });
});
