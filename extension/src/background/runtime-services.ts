import { createDefaultIntentParser } from "./intent-parser";
import { createPolicyPreviewAdapter } from "./preview-adapter";
import { createDefaultRiskAdapter } from "./risk-adapter";
import { createDefaultQuoteAdapter } from "./quote-adapter";
import { JitoAdapter } from "./jito-adapter";
import type { SIPIntent, SIPAction } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { ExecutionPreview } from "../shared/execution";
import type { DetectedContextSnapshot } from "../shared/context";

export interface RuntimeServices {
  parseIntent(
    userInput: string,
    context?: DetectedContextSnapshot
  ): Promise<SIPIntent>;
  scanRisk(intent: SIPIntent): Promise<SecurityReport>;
  buildPreview(
    requestId: string,
    intent: SIPIntent,
    transactions?: string[]
  ): Promise<ExecutionPreview>;
  getOrder(action: SIPAction): Promise<{ quote: any; swapTransaction: string }>;
  simulateBundle(transactions: string[]): Promise<any>;
}

export function createMockRuntimeServices(): RuntimeServices {
  const parser = createDefaultIntentParser();
  const riskAdapter = createDefaultRiskAdapter();
  const previewAdapter = createPolicyPreviewAdapter();
  const quoteAdapter = createDefaultQuoteAdapter();
  const jitoAdapter = new JitoAdapter();

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview,
    getOrder: quoteAdapter.getOrder,
    simulateBundle: (transactions) => jitoAdapter.simulateBundle(transactions)
  };
}

export function createProductionRuntimeServices(config: {
  jupiterBaseUrl?: string;
}): RuntimeServices {
  const parser = createDefaultIntentParser();
  const riskAdapter = createDefaultRiskAdapter();
  const quoteAdapter = createDefaultQuoteAdapter({ baseUrl: config.jupiterBaseUrl });
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

