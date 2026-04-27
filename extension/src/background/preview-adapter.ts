import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SimulationAdapter, SimulationResult } from "./simulation-adapter";
import type { QuoteAdapter } from "./quote-adapter";
import { createDefaultQuoteAdapter } from "./quote-adapter";
import { createDefaultSimulationAdapter } from "./simulation-adapter";
import { mockExecutionPreview } from "./mock-services";

export interface PreviewAdapter {
  buildPreview(
    requestId: string,
    intent: SIPIntent,
    transactions?: string[],
    preSimulation?: any,
    preQuote?: any
  ): Promise<ExecutionPreview>;
}

export function createMockPreviewAdapter(): PreviewAdapter {
  return {
    buildPreview: mockExecutionPreview
  };
}

export function createPolicyPreviewAdapter(options?: {
  quoteAdapter?: QuoteAdapter;
  simulationAdapter?: SimulationAdapter;
}): PreviewAdapter {
  const quoteAdapter = options?.quoteAdapter ?? createDefaultQuoteAdapter();
  const simulationAdapter = options?.simulationAdapter ?? createDefaultSimulationAdapter();

  return {
    async buildPreview(
      requestId: string,
      intent: SIPIntent,
      transactions?: string[],
      preSimulation?: any,
      preQuote?: any
    ): Promise<ExecutionPreview> {

      if (!intent.actions || intent.actions.length === 0) {
        throw new Error("No actions to preview");
      }
      const action = intent.actions[0];

      // 核心优化：如果外部传了 quote 数据（例如来自 message-router），则不再重复调用 Jupiter
      let quote: any;
      let swapTransaction: string;

      if (preQuote) {
          console.log("[Preview Adapter] Reusing pre-fetched quote data.");
          quote = preQuote;
          swapTransaction = transactions && transactions.length > 0 ? transactions[0] : (preQuote.transaction || "");
      } else {
          console.warn("[Preview Adapter] Missing preQuote, fetching from Jupiter again.");
          const result = await quoteAdapter.getOrder(action);
          quote = result.quote;
          swapTransaction = result.swapTransaction;
      }

      // 模拟与演练部分
      let simulation: SimulationResult;
      if (preSimulation && preSimulation.success) {
        console.log("[Preview Adapter] Using pre-simulation results.");
        simulation = {
            simulationSummary: preSimulation.summary,
            success: true
        };
      } else {
        const txToSimulate = transactions && transactions.length > 0 ? transactions[0] : swapTransaction;
        if (!txToSimulate) throw new Error("No transaction payload to simulate.");   
        simulation = await simulationAdapter.simulate(intent, txToSimulate);
      }

      if (!simulation.success) {
        throw new Error(simulation.error || simulation.simulationSummary);
      }

      const totalFee = (Number(quote?.signatureFeeLamports || 0) + Number(quote?.prioritizationFeeLamports || 0)).toString();
      const isMultiAction = transactions && transactions.length > 1;

      return {
        requestId,
        routeLabel: isMultiAction ? "Atomic Bundle" : "Jupiter Swap",
        inputAmount: quote?.inAmount || action.payload?.amount || "0",
        outputAmount: quote?.outAmount || "0",
        slippageBps: action.payload?.slippageBps || 50,
        estimatedFeeLamports: totalFee,
        simulationSummary: simulation.simulationSummary,
        bundleTransactions: transactions && transactions.length > 0 ? transactions : [swapTransaction],
        swapTransaction: transactions && transactions.length > 0 ? transactions[0] : swapTransaction,
        protocolFeeAmount: quote?.platformFee?.amount || "0",
        protocolFeeMint: quote?.platformFee?.feeMint || quote?.feeMint || "",        
        platformFeeBps: quote?.platformFee?.feeBps || quote?.feeBps || 0,
        signatureFeeLamports: quote?.signatureFeeLamports || 0,
        prioritizationFeeLamports: quote?.prioritizationFeeLamports || 0,
        rentFeeLamports: quote?.rentFeeLamports || 0
      };
    }
  };
}
