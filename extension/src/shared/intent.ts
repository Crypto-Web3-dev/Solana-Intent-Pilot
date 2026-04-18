export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";
export type AmountMode = "exact" | "half" | "all";

export interface SIPIntent {
  intent: IntentType;
  confidence: number;
  payload: {
    inputMint: string;
    outputMint: string;
    amount: string;
    amountMode: AmountMode;
    slippageBps: number;
    platform: string;
  };
  metadata: {
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
  };
}
