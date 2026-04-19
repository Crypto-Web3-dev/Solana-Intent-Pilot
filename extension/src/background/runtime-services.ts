import type { DetectedContextSnapshot } from "../shared/context";
import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import { createDefaultIntentParser } from "./intent-parser";
import { createMockPreviewAdapter, createPolicyPreviewAdapter } from "./preview-adapter";
import { createDefaultRiskAdapter } from "./risk-adapter";

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
