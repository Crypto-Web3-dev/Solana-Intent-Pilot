import { describe, expect, it } from "vitest";
import { createDefaultRiskAdapter } from "../../src/background/risk-adapter";
import type { SIPIntent } from "../../src/shared/intent";

const intent: SIPIntent = {
  intent: "SWAP",
  confidence: 0.92,
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000",
    amountMode: "exact",
    slippageBps: 100,
    platform: "x.com"
  },
  metadata: {
    reasoning: "Test intent",
    requiresRiskScan: true,
    sourceContext: ["x.com"],
    needsClarification: false
  }
};

describe("risk adapter", () => {
  it("reports wasm as the active risk engine source when wasm succeeds", async () => {
    const adapter = createDefaultRiskAdapter({
      loadWasmRiskEngine: async () => ({
        scanRisk: async () => ({
          source: "wasm",
          score: 88,
          level: "low",
          blocking: false,
          checks: [],
          summary: "Wasm checks passed"
        })
      })
    });

    const report = await adapter.scanRisk(intent);

    expect(report.source).toBe("wasm");
    expect(report.summary).toBe("Wasm checks passed");
  });

  it("falls back to policy when wasm is unavailable", async () => {
    const adapter = createDefaultRiskAdapter({
      loadWasmRiskEngine: async () => null
    });

    const report = await adapter.scanRisk(intent);

    expect(report.source).toBe("policy-fallback");
    expect(report.blocking).toBe(false);
  });
});
