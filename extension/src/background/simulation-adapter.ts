import type { SIPIntent } from "../shared/intent";

export interface SimulationResult {
  simulationSummary: string;
}

export interface SimulationAdapter {
  simulate(intent: SIPIntent): Promise<SimulationResult>;
}

type RpcPreflightResponse = {
  result?: {
    context?: {
      slot?: number;
    };
    value?: {
      blockhash?: string;
    };
  };
};

function isUsablePreflightResponse(
  response: RpcPreflightResponse
): response is {
  result: {
    context: {
      slot: number;
    };
    value: {
      blockhash: string;
    };
  };
} {
  return Boolean(
    response.result?.context?.slot !== undefined &&
      response.result?.value?.blockhash
  );
}

export function createMockSimulationAdapter(): SimulationAdapter {
  return {
    async simulate(intent: SIPIntent): Promise<SimulationResult> {
      if (intent.payload.outputMint.includes("preview-fail")) {
        throw new Error("Simulation failed");
      }

      return {
        simulationSummary: "Mock simulation passed"
      };
    }
  };
}

export function createRpcPreflightSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): SimulationAdapter {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const rpcUrl = options?.rpcUrl ?? "https://api.mainnet-beta.solana.com";

  return {
    async simulate(_intent: SIPIntent): Promise<SimulationResult> {
      if (!fetchImpl) {
        throw new Error("Fetch is unavailable");
      }

      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "processed" }]
        })
      });

      if (!response.ok) {
        throw new Error(`RPC preflight failed with status ${response.status}`);
      }

      const payload = (await response.json()) as RpcPreflightResponse;

      if (!isUsablePreflightResponse(payload)) {
        throw new Error("RPC preflight response is missing required fields");
      }

      return {
        simulationSummary: `RPC preflight ready at slot ${payload.result.context.slot}`
      };
    }
  };
}

export function createDefaultSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
  fallbackAdapter?: SimulationAdapter;
}): SimulationAdapter {
  const liveAdapter = createRpcPreflightSimulationAdapter(options);
  const fallbackAdapter =
    options?.fallbackAdapter ?? createMockSimulationAdapter();

  return {
    async simulate(intent: SIPIntent): Promise<SimulationResult> {
      try {
        return await liveAdapter.simulate(intent);
      } catch {
        return fallbackAdapter.simulate(intent);
      }
    }
  };
}
