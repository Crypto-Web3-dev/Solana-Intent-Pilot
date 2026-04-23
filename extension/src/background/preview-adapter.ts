import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SimulationAdapter, SimulationResult } from "./simulation-adapter";
import type { QuoteAdapter, QuoteResult } from "./quote-adapter";
import { createDefaultQuoteAdapter } from "./quote-adapter";
import { createDefaultSimulationAdapter } from "./simulation-adapter";
import { mockExecutionPreview } from "./mock-services";

export interface PreviewAdapter {
  buildPreview(requestId: string, intent: SIPIntent, transactions?: string[]): Promise<ExecutionPreview>;
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
  const simulationAdapter =
    options?.simulationAdapter ?? createDefaultSimulationAdapter();

  return {
    async buildPreview(requestId: string, intent: SIPIntent, transactions?: string[]): Promise<ExecutionPreview> {
      // 如果提供了交易束，则进行束预览
      if (transactions && transactions.length > 0) {
        const simulation = await simulationAdapter.simulate(intent, transactions[0]); // TODO: Update simulation adapter for bundles

        return {
          requestId,
          routeLabel: "Bundle",
          inputAmount: "multi",
          outputAmount: "multi",
          slippageBps: 0,
          estimatedFeeLamports: "0",
          simulationSummary: simulation.simulationSummary,
          bundleTransactions: transactions
        };
      }

      // 回退到单动作流程（向后兼容）
      if (!intent.actions || intent.actions.length === 0) {
        throw new Error("No actions to preview");
      }

      const action = intent.actions[0];
      const { quote, swapTransaction } = await quoteAdapter.getOrder(action);
      const simulation = await simulationAdapter.simulate(intent, swapTransaction);

      const totalFee = (Number(quote.signatureFeeLamports || 0) + Number(quote.prioritizationFeeLamports || 0)).toString();

      return {
        requestId,
        routeLabel: "Jupiter",
        inputAmount: quote.inAmount,
        outputAmount: quote.outAmount,
        slippageBps: action.payload.slippageBps,
        estimatedFeeLamports: totalFee,
        simulationSummary: simulation.simulationSummary,
        swapTransaction
      };
    }
  };
}

