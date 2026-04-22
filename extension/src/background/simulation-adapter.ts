import type { SIPIntent } from "../shared/intent";

export interface SimulationResult {
  simulationSummary: string;
  success: boolean;
  error?: string;
}

export interface SimulationAdapter {
  simulate(intent: SIPIntent, transaction?: string | null): Promise<SimulationResult>;
}

type RpcSimulationResponse = {
  result?: {
    value?: {
      err?: any;
      logs?: string[];
      unitsConsumed?: number;
    };
  };
  error?: {
    message: string;
  };
};

export function createMockSimulationAdapter(): SimulationAdapter {
  return {
    async simulate(intent: SIPIntent): Promise<SimulationResult> {
      if (intent.payload.outputMint.includes("preview-fail")) {
        throw new Error("Simulation failed");
      }

      return {
        simulationSummary: "Mock simulation passed",
        success: true
      };
    }
  };
}

export function createRpcSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): SimulationAdapter {
  const fetchImpl = options?.fetchImpl || globalThis.fetch;
  // 使用 Helius 免费节点或提供的 RPC
  const rpcUrl = options?.rpcUrl || "https://mainnet.helius-rpc.com/?api-key=827faf6e-07f0-45a2-9096-27f3d9e97217";

  return {
    async simulate(_intent: SIPIntent, transaction?: string | null): Promise<SimulationResult> {
      if (!transaction) {
        return {
          simulationSummary: "No transaction payload to simulate.",
          success: false
        };
      }

      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "simulateTransaction",
          params: [
            transaction,
            {
              encoding: "base64",
              commitment: "processed",
              replaceRecentBlockhash: true
            }
          ]
        })
      });

      const payload = (await response.json()) as RpcSimulationResponse;

      if (payload.error) {
        throw new Error(payload.error.message);
      }

      const value = payload.result?.value;
      if (!value) {
        throw new Error("Invalid RPC simulation response");
      }

      if (value.err) {
        return {
          simulationSummary: `Simulation failed: ${JSON.stringify(value.err)}`,
          success: false,
          error: JSON.stringify(value.err)
        };
      }

      return {
        simulationSummary: `Success: Consumed ${value.unitsConsumed || 0} CU.`,
        success: true
      };
    }
  };
}

export function createDefaultSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
  fallbackAdapter?: SimulationAdapter;
}): SimulationAdapter {
  const liveAdapter = createRpcSimulationAdapter(options);
  const fallbackAdapter = options?.fallbackAdapter || createMockSimulationAdapter();

  return {
    async simulate(intent: SIPIntent, transaction?: string | null): Promise<SimulationResult> {
      try {
        const result = await liveAdapter.simulate(intent, transaction);
        // 如果 RPC 成功返回了结果（无论模拟成功还是失败），我们都使用它
        return result;
      } catch {
        return fallbackAdapter.simulate(intent, transaction);
      }
    }
  };
}
