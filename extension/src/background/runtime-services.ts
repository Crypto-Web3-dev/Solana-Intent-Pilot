import { createDefaultIntentParser } from "./intent-parser";
import { createPolicyPreviewAdapter } from "./preview-adapter";
import { createDefaultRiskAdapter } from "./risk-adapter";
import { createDefaultQuoteAdapter } from "./quote-adapter";

export interface RuntimeServices {
  parseIntent(
    userInput: string,
    context?: DetectedContextSnapshot
  ): Promise<SIPIntent>;
  scanRisk(intent: SIPIntent): Promise<SecurityReport>;
  buildPreview(
    requestId: string,
    intent: SIPIntent
  ): Promise<ExecutionPreview>;
}

export function createMockRuntimeServices(): RuntimeServices {
  const parser = createDefaultIntentParser();
  const riskAdapter = createDefaultRiskAdapter();
  const previewAdapter = createPolicyPreviewAdapter();

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview
  };
}

export function createProductionRuntimeServices(config: {
  jupiterBaseUrl?: string;
}): RuntimeServices {
  const parser = createDefaultIntentParser();
  const riskAdapter = createDefaultRiskAdapter();
  const previewAdapter = createPolicyPreviewAdapter({
    quoteAdapter: createDefaultQuoteAdapter({ baseUrl: config.jupiterBaseUrl })
  });

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview
  };
}
