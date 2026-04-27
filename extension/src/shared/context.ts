export interface TokenHint {
  symbol?: string;
  name?: string;
  mint?: string;
  source: "twitter" | "birdeye" | "dexscreener" | "generic";
  confidence: number;
  verified?: boolean;
  verificationSource?: "jupiter" | "solscan";
  decimals?: number;
  icon?: string;
}

export interface DetectedContextSnapshot {
  tabId: number;
  url: string;
  title: string;
  selectedText?: string;
  detectedTokens: TokenHint[];
  rawHints: string[];
  detectedAt: string;
}
