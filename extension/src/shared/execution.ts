export interface ExecutionPreview {
  requestId: string;
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
  simulationSummary?: string;
  swapTransaction?: string;
  bundleTransactions?: string[];
  protocolFeeAmount?: string;
  protocolFeeMint?: string;
  platformFeeBps?: number;
  signatureFeeLamports?: number;
  prioritizationFeeLamports?: number;
  rentFeeLamports?: number;
}
