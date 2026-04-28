import { createDefaultIntentParser, createMockIntentParser } from "./intent-parser";
import {
  createMockPreviewAdapter,
  createPolicyPreviewAdapter
} from "./preview-adapter";
import {
  createDefaultRiskAdapter,
  createMockRiskAdapter
} from "./risk-adapter";
import {
  createDefaultQuoteAdapter,
  createMockQuoteAdapter
} from "./quote-adapter";
import { JitoAdapter } from "./jito-adapter";
import type { SIPIntent, SIPAction } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { ExecutionPreview } from "../shared/execution";
import type { DetectedContextSnapshot } from "../shared/context";
import { createMockSimulationAdapter } from "./simulation-adapter";

export interface RuntimeServices {
  parseIntent(
    userInput: string,
    context?: DetectedContextSnapshot,
    userPublicKey?: string
  ): Promise<SIPIntent>;
  scanRisk(intent: SIPIntent): Promise<SecurityReport>;
  buildPreview(
    requestId: string,
    intent: SIPIntent,
    transactions?: string[],
    preSimulation?: any // 允许传入预模拟结果以减少 RPC 访问
  ): Promise<ExecutionPreview>;
  getOrder(action: SIPAction): Promise<{ quote: any; swapTransaction: string }>;
  simulateBundle(transactions: string[]): Promise<any>;
}

export function createMockRuntimeServices(): RuntimeServices {
  const parser = createMockIntentParser();
  const riskAdapter = createMockRiskAdapter();
  const previewAdapter = createMockPreviewAdapter();
  const quoteAdapter = createMockQuoteAdapter();
  const simulationAdapter = createMockSimulationAdapter();

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview,
    getOrder: quoteAdapter.getOrder,
    simulateBundle: async (transactions) => {
      const firstTransaction = transactions[0] ?? null;
      return simulationAdapter.simulate(
        {
          intentId: "mock-bundle",
          actions: [],
          mode: "ATOMIC_BUNDLE",
          metadata: {
            strategyGoal: "Mock bundle",
            estimatedNetChange: {},
            jitoTipLamports: 0,
            reasoning: "Mock bundle simulation",
            requiresRiskScan: false,
            sourceContext: [],
            needsClarification: false
          }
        },
        firstTransaction
      );
    }
  };
}

export function createProductionRuntimeServices(config: {
  jupiterBaseUrl?: string;
  jupiterApiKey?: string;
  rpcUrl?: string;
}): RuntimeServices {
  const parser = createDefaultIntentParser({
    jupiterApiKey: config.jupiterApiKey
  });
  const riskAdapter = createDefaultRiskAdapter();
  const quoteAdapter = createDefaultQuoteAdapter({
    baseUrl: config.jupiterBaseUrl,
    apiKey: config.jupiterApiKey
  });
  const previewAdapter = createPolicyPreviewAdapter({
    quoteAdapter
  });
  const jitoAdapter = new JitoAdapter();

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview,
    getOrder: quoteAdapter.getOrder,
    simulateBundle: (transactions) => jitoAdapter.simulateBundle(transactions)
  };
}
