export type IntentMode = "SINGLE" | "ATOMIC_BUNDLE" | "PARALLEL";

export interface SIPAction {
  id: string;
  type: "SWAP" | "STAKE" | "LEND" | "TRANSFER";
  status: "pending" | "ready" | "failed";
  payload: {
    inputMint?: string;
    outputMint?: string;
    amount?: string;
    amountMode?: "exact" | "percentage";
    swapMode?: "ExactIn" | "ExactOut";
    slippageBps?: number;
    platform?: string;
    userPublicKey?: string;
    recipient?: string;
    mint?: string;
    inputSymbol?: string;
    outputSymbol?: string;
    outputTokenName?: string;
    outputTokenVerified?: boolean;
    outputTokenVerificationSource?: "jupiter" | "solscan";
    outputTokenIcon?: string;
    symbol?: string;
    inputDecimals?: number;
    outputDecimals?: number;
    decimals?: number;
  };
}

export interface SIPIntent {
  intentId: string;
  mode: IntentMode;
  actions: SIPAction[];
  metadata: {
    strategyGoal: string;
    reasoning: string;
    jitoTipLamports: number;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
    clarification?: ClarificationPayload;
    riskContext?: {
      mintAuthority?: string | null;
      freezeAuthority?: string | null;
      isJupVerified?: boolean;
      liquidityUsd?: number;
      tokenCreatedAt?: number;
      tokenAgeHours?: number;
    };
  };
}

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
