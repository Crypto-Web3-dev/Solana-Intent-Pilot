import { describe, expect, it, vi } from "vitest";
import {
  createDefaultSimulationAdapter,
  createRpcSimulationAdapter,
  type SimulationAdapter
} from "../../src/background/simulation-adapter";
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

const mockTx = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

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

    const adapter = createDefaultSimulationAdapter({ fetchImpl });
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

    const adapter = createDefaultSimulationAdapter({ fetchImpl });
    const result = await adapter.simulate(validIntent, mockTx);

    expect(result.success).toBe(false);
    expect(result.simulationSummary).toContain("Simulation failed");
    expect(result.error).toContain("InsufficientFunds");
  });

  it("falls back to mock when RPC request fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network error"));
    const adapter = createDefaultSimulationAdapter({ fetchImpl });

    const result = await adapter.simulate(validIntent, mockTx);

    // Mock adapter returns "Mock simulation passed"
    expect(result.simulationSummary).toBe("Mock simulation passed");
    expect(result.success).toBe(true);
  });

  it("returns failure summary when no transaction is provided", async () => {
    const adapter = createRpcSimulationAdapter();
    const result = await adapter.simulate(validIntent, null);

    expect(result.success).toBe(false);
    expect(result.simulationSummary).toBe("No transaction payload to simulate.");
  });
});
