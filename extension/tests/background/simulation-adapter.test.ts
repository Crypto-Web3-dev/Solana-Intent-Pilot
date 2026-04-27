import { describe, expect, it, vi } from "vitest";
import {
  createDefaultSimulationAdapter,
  createMockSimulationAdapter,
  createRpcSimulationAdapter
} from "../../src/background/simulation-adapter";
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

const mockTx =
  "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const rpcUrl = "https://rpc.test.local";

describe("default simulation adapter", () => {
  it("uses a real RPC simulation response when available", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          value: {
            err: null,
            unitsConsumed: 1250,
            logs: ["Program log: Instruction: Swap"]
          }
        }
      })
    });

    const adapter = createDefaultSimulationAdapter({ fetchImpl, rpcUrl });
    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.success).toBe(true);
    expect(result.simulationSummary).toContain("Success");
    expect(result.simulationSummary).toContain("1250 CU");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("handles RPC simulation errors correctly", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          value: {
            err: { InstructionError: [0, "InsufficientFunds"] }
          }
        }
      })
    });

    const adapter = createDefaultSimulationAdapter({ fetchImpl, rpcUrl });
    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.success).toBe(false);
    expect(result.simulationSummary).toContain("Simulation failed");
    expect(result.error).toContain("InsufficientFunds");
  });

  it("returns a degraded failure result when RPC request fails without a fallback", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
    const adapter = createDefaultSimulationAdapter({ fetchImpl, rpcUrl });

    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.simulationSummary).toBe(
      "Live simulation failed and no fallback is configured."
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("simulation-live-failed");
  });

  it("marks fallback simulation as degraded instead of success-like", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
    const adapter = createDefaultSimulationAdapter({
      fetchImpl,
      rpcUrl,
      fallbackAdapter: createMockSimulationAdapter()
    });

    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.simulationSummary).toBe(
      "Live simulation failed. Falling back to a degraded preview path."
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe("simulation-fallback-used");
  });

  it("returns failure summary when no transaction is provided", async () => {
    const adapter = createRpcSimulationAdapter();
    const result = await adapter.simulate(validIntent, null);

    expect(result.success).toBe(false);
    expect(result.simulationSummary).toBe("No transaction payload to simulate.");
  });

  it("returns a failure result when no RPC provider is configured", async () => {
    const adapter = createRpcSimulationAdapter({ rpcUrl: "" });
    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.success).toBe(false);
    expect(result.simulationSummary).toBe("Simulation provider is not configured.");
    expect(result.error).toBe("simulation-provider-missing");
  });
});
