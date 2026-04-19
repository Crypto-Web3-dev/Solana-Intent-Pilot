import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

export interface WasmRiskEngine {
  scanRisk(intent: SIPIntent): Promise<SecurityReport | null>;
}

export async function loadDefaultWasmRiskEngine(): Promise<WasmRiskEngine | null> {
  return null;
}
