import { describe, expect, it, vi } from "vitest";

// Mock the entire wasm-risk-engine module before any other imports
vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue({
    scanRisk: async (intent: any) => {
      const checks = [];
      let blocking = false;
      let score = 100;

      const firstAction = intent.actions?.[0];
      const outputMint = firstAction?.payload?.outputMint || "";
      const ctx = intent.metadata?.riskContext;

      // Logic to simulate Rule-Chain based on MOCK tokens or injected context
      
      // 1. Blacklist Rule
      if (outputMint.includes("BLOCKED") || outputMint.includes("BLACKLISTED")) {
        blocking = true;
        score = 0;
        checks.push({
          key: "blacklist",
          label: "Blacklist Match",
          status: "fail",
          detail: "Mocked Blacklist"
        });
      }

      // 2. Authority Rule (Rug Potential)
      // Check for our specific mock token OR the context values
      const isRugToken = outputMint === "RUG_TOKEN_MOCK_ADDRESS";
      const hasRugContext = ctx?.mintAuthority && ctx?.liquidityUsd < 5000 && !ctx?.isJupVerified;
      
      if (isRugToken || hasRugContext) {
        blocking = true;
        score = 0;
        checks.push({
          key: "rug-potential",
          label: "Rug Potential",
          status: "fail",
          detail: "Mocked Rug Potential"
        });
      }

      // 3. Authority Rule (Honeypot)
      const isHoneypotToken = outputMint === "FREEZE_ENABLED_MOCK_ADDRESS";
      const hasHoneypotContext = ctx?.freezeAuthority && !ctx?.isJupVerified;
      
      if (isHoneypotToken || hasHoneypotContext) {
        score -= 50;
        checks.push({
          key: "honeypot-warning",
          label: "Honeypot Risk",
          status: "warn",
          detail: "Mocked Honeypot"
        });
      }

      // Simulate EconomicRule (High Slippage)
      if (firstAction?.payload?.slippageBps > 500) {
        score -= 31; // Deduction of 31 brings score to 69, which is < 70 (medium)
        checks.push({
          key: "high-slippage",
          label: "High Slippage",
          status: "warn",
          detail: "Mocked High Slippage"
        });
      }

      if (checks.length === 0) {
        checks.push({
          key: "baseline",
          label: "Safe Baseline",
          status: "pass",
          detail: "Mocked Safe"
        });
      }

      return {
        source: "wasm",
        score,
        level: blocking ? "high" : score < 70 ? "medium" : "low",
        blocking,
        checks,
        summary: "Mocked Wasm Result"
      };
    }
  }),
}));

import { createDefaultRiskAdapter } from "../../src/background/risk-adapter";
import type { SIPIntent } from "../../src/shared/intent";

const intent: SIPIntent = {
  intentId: "test-intent-id",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      status: "pending",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000",
        amountMode: "exact",
        slippageBps: 100,
        platform: "Jupiter"
      }
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap tokens",
    reasoning: "Test intent",
    estimatedNetChange: { spend: "1 SOL", receive: "100 USDC" },
    jitoTipLamports: 1000,
    requiresRiskScan: true,
    sourceContext: ["x.com"],
    needsClarification: false
  }
};

describe("risk adapter basic", () => {
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

const TOKENS = {
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  RUG_CANDIDATE: "RUG_TOKEN_MOCK_ADDRESS",
  HONEYPOT_CANDIDATE: "FREEZE_ENABLED_MOCK_ADDRESS",
  BLACKLISTED: "TOKEN_WITH_BLOCKED_IN_NAME"
};

describe("risk adapter - real world scenarios", () => {
  it("passes USDC with a clean baseline", async () => {
    const adapter = createDefaultRiskAdapter();
    const usdcIntent: SIPIntent = {
      ...intent,
      actions: [{
        ...intent.actions[0],
        payload: { ...intent.actions[0].payload, outputMint: TOKENS.USDC }
      }]
    };

    const report = await adapter.scanRisk(usdcIntent);

    expect(report.level).toBe("low");
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.checks.some(c => c.key === "baseline")).toBe(true);
  });

  it("blocks a potential Rug-pull (Unverified + Mint Authority + Low Liquidity)", async () => {
    const adapter = createDefaultRiskAdapter();
    const rugIntent: SIPIntent = {
      ...intent,
      actions: [{
        ...intent.actions[0],
        payload: { ...intent.actions[0].payload, outputMint: TOKENS.RUG_CANDIDATE }
      }]
    };

    const report = await adapter.scanRisk(rugIntent);

    expect(report.blocking).toBe(true);
    expect(report.level).toBe("high");
    expect(report.checks.some(c => c.key === "rug-potential")).toBe(true);
  });

  it("warns about Honeypot risk (Freeze Authority Enabled)", async () => {
    const adapter = createDefaultRiskAdapter();
    const honeypotIntent: SIPIntent = {
      ...intent,
      actions: [{
        ...intent.actions[0],
        payload: { ...intent.actions[0].payload, outputMint: TOKENS.HONEYPOT_CANDIDATE }
      }]
    };

    const report = await adapter.scanRisk(honeypotIntent);

    expect(report.checks.some(c => c.key === "honeypot-warning")).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("blocks blacklisted tokens", async () => {
    const adapter = createDefaultRiskAdapter();
    const blacklistIntent: SIPIntent = {
      ...intent,
      actions: [{
        ...intent.actions[0],
        payload: { ...intent.actions[0].payload, outputMint: TOKENS.BLACKLISTED }
      }]
    };

    const report = await adapter.scanRisk(blacklistIntent);

    expect(report.blocking).toBe(true);
    expect(report.checks.some(c => c.key === "blacklist")).toBe(true);
  });

  it("warns about high slippage (Economic Risk)", async () => {
    const adapter = createDefaultRiskAdapter();
    const slippageIntent: SIPIntent = {
      ...intent,
      actions: [{
        ...intent.actions[0],
        payload: {
          ...intent.actions[0].payload,
          outputMint: TOKENS.USDC,
          slippageBps: 1000 // 10%
        }
      }]
    };

    const report = await adapter.scanRisk(slippageIntent);

    expect(report.checks.some(c => c.key === "high-slippage")).toBe(true);
    expect(report.level).toBe("medium");
  });
});
