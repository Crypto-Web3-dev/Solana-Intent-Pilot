export interface TokenHint {
  symbol?: string;
  mint?: string;
  source: "twitter" | "birdeye" | "dexscreener" | "generic";
  confidence: number;
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
