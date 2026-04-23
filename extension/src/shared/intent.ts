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

export interface SIPAction {
  id: string;
  type: "SWAP" | "STAKE" | "LEND" | "TRANSFER";
  payload: any;
  status: "pending" | "ready" | "failed";
}

export interface SIPIntent {
  intentId: string;
  actions: SIPAction[];
  mode: "ATOMIC_BUNDLE" | "SINGLE";
  metadata: {
    strategyGoal: string;
    estimatedNetChange: any;
    jitoTipLamports: number;
    reasoning: string;
    needsClarification: boolean;
    sourceContext: string[];
    clarification?: ClarificationPayload;
  };
}
