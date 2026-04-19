import { describe, expect, it, vi } from "vitest";
import {
  createDefaultSimulationAdapter,
  createRpcPreflightSimulationAdapter,
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

describe("default simulation adapter", () => {
  it("uses an RPC preflight response when the provider is healthy", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          context: {
            slot: 123456
          },
          value: {
            blockhash: "abc",
            lastValidBlockHeight: 99
          }
        }
      })
    });

    const adapter = createDefaultSimulationAdapter({ fetchImpl });
    const result = await adapter.simulate(validIntent);

    expect(result.simulationSummary).toContain("RPC preflight ready");
    expect(result.simulationSummary).toContain("slot 123456");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the mock adapter when the RPC preflight fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("rpc down"));
    const adapter = createDefaultSimulationAdapter({ fetchImpl });

    const result = await adapter.simulate(validIntent);

    expect(result.simulationSummary).toBe("Mock simulation passed");
  });

  it("falls back to a custom adapter when the provider data is malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          value: {
            blockhash: "abc"
          }
        }
      })
    });
    const fallbackAdapter: SimulationAdapter = {
      simulate: vi.fn().mockResolvedValue({
        simulationSummary: "Fallback simulation"
      })
    };

    const adapter = createDefaultSimulationAdapter({
      fetchImpl,
      fallbackAdapter
    });
    const result = await adapter.simulate(validIntent);

    expect(result.simulationSummary).toBe("Fallback simulation");
    expect(fallbackAdapter.simulate).toHaveBeenCalledWith(validIntent);
  });

  it("fails live simulation mapping when required fields are missing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          context: {
            slot: 123456
          },
          value: {}
        }
      })
    });

    const adapter = createRpcPreflightSimulationAdapter({ fetchImpl });

    await expect(adapter.simulate(validIntent)).rejects.toThrow(
      "RPC preflight response is missing required fields"
    );
  });
});
