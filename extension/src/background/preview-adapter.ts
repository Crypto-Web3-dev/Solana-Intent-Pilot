import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SimulationAdapter, SimulationResult } from "./simulation-adapter";
import type { QuoteAdapter, QuoteResult } from "./quote-adapter";
import { createDefaultQuoteAdapter } from "./quote-adapter";
import { createDefaultSimulationAdapter } from "./simulation-adapter";
import { mockExecutionPreview } from "./mock-services";

export interface PreviewAdapter {
  buildPreview(requestId: string, intent?: SIPIntent): Promise<ExecutionPreview>;
}

export function createMockPreviewAdapter(): PreviewAdapter {
  return {
    buildPreview: mockExecutionPreview
  };
}

async function combinePreview(
  requestId: string,
  quote: QuoteResult,
  simulation: SimulationResult
): Promise<ExecutionPreview> {
  return {
    requestId,
    routeLabel: quote.routeLabel,
    inputAmount: quote.inputAmount,
    outputAmount: quote.outputAmount,
    slippageBps: quote.slippageBps,
    estimatedFeeLamports: quote.estimatedFeeLamports,
    simulationSummary: simulation.simulationSummary
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
    async buildPreview(requestId: string, intent?: SIPIntent): Promise<ExecutionPreview> {
      if (!intent) {
        throw new Error("Intent is required to build a preview");
      }

      const quote = await quoteAdapter.getQuote(intent);
      const simulation = await simulationAdapter.simulate(intent);

      return combinePreview(requestId, quote, simulation);
    }
  };
}
