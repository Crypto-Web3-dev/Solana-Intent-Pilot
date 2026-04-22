export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";
export type AmountMode = "exact" | "half" | "all";

export type ClarificationKind =
  | "missing-output-mint"
  | "unknown-output-mint"
  | "ambiguous-output-mint"
  | "underspecified-request";

export interface ClarificationPayload {
  kind: ClarificationKind;
  message: string;
  candidateSymbols?: string[];
}

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
    userPublicKey?: string;
  };
  metadata: {
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
    clarification?: ClarificationPayload;
  };
}
