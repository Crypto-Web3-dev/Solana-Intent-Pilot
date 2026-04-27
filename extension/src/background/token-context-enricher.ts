import type { DetectedContextSnapshot, TokenHint } from "../shared/context";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type TokenVerificationFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface TokenContextEnricherOptions {
  fetchImpl?: TokenVerificationFetch;
  maxMintChecks?: number;
  jupiterApiKey?: string;
}

type TokenMetadata = {
  mint?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  icon?: string;
  verificationSource: "jupiter" | "solscan";
};

export async function enrichDetectedContext(
  context: DetectedContextSnapshot,
  options: TokenContextEnricherOptions = {}
): Promise<DetectedContextSnapshot> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxMintChecks = options.maxMintChecks ?? 8;

  if (!fetchImpl) return context;

  const enrichedTokens: TokenHint[] = [];
  let checkedMints = 0;

  for (const token of context.detectedTokens) {
    if (!token.mint) {
      if (!token.symbol || checkedMints >= maxMintChecks) {
        enrichedTokens.push(token);
        continue;
      }

      checkedMints += 1;
      const metadata = await verifyJupiterTokenSymbol(
        token.symbol,
        fetchImpl,
        options.jupiterApiKey
      ).catch(() => null);

      enrichedTokens.push(
        metadata
          ? {
              ...token,
              mint: metadata.mint,
              name: metadata.name ?? token.name,
              symbol: metadata.symbol ?? token.symbol,
              decimals: metadata.decimals ?? token.decimals,
              icon: metadata.icon ?? token.icon,
              confidence: Math.max(token.confidence, 0.9),
              verified: true,
              verificationSource: metadata.verificationSource
            }
          : token
      );
      continue;
    }

    if (!SOLANA_ADDRESS_PATTERN.test(token.mint)) {
      continue;
    }

    if (checkedMints >= maxMintChecks) {
      continue;
    }

    checkedMints += 1;
    const metadata = await verifyTokenMint(token.mint, {
      fetchImpl,
      jupiterApiKey: options.jupiterApiKey
    }).catch(() => null);
    if (!metadata) {
      continue;
    }

    enrichedTokens.push({
      ...token,
      name: metadata.name ?? token.name,
      symbol: metadata.symbol ?? token.symbol,
      decimals: metadata.decimals ?? token.decimals,
      icon: metadata.icon ?? token.icon,
      confidence: Math.max(token.confidence, 0.92),
      verified: true,
      verificationSource: metadata.verificationSource
    });
  }

  return {
    ...context,
    detectedTokens: mergeTokenHints(enrichedTokens)
  };
}

export async function verifyTokenMint(
  mint: string,
  options: {
    fetchImpl?: TokenVerificationFetch;
    jupiterApiKey?: string;
  } = {}
): Promise<TokenMetadata | null> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) return null;

  const jupiterMetadata = await verifyJupiterToken(
    mint,
    fetchImpl,
    options.jupiterApiKey
  ).catch(() => null);
  if (jupiterMetadata) return jupiterMetadata;

  return verifySolscanToken(mint, fetchImpl).catch(() => null);
}

export async function verifyJupiterToken(
  mint: string,
  fetchImpl: TokenVerificationFetch = globalThis.fetch,
  apiKey?: string
): Promise<TokenMetadata | null> {
  if (!SOLANA_ADDRESS_PATTERN.test(mint)) return null;

  const response = await fetchImpl(
    `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`,
    {
      method: "GET",
      headers: apiKey ? { "x-api-key": apiKey } : undefined
    }
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const tokens = Array.isArray(payload) ? payload : [];
  const match = tokens.find(
    (token) => token?.id === mint || token?.address === mint || token?.mint === mint
  );
  if (!match) return null;

  return {
    mint: match.id ?? match.address ?? match.mint,
    name: typeof match.name === "string" ? match.name : undefined,
    symbol: typeof match.symbol === "string" ? match.symbol : undefined,
    decimals: typeof match.decimals === "number" ? match.decimals : undefined,
    icon: typeof match.icon === "string" ? match.icon : undefined,
    verificationSource: "jupiter"
  };
}

export async function verifyJupiterTokenSymbol(
  symbol: string,
  fetchImpl: TokenVerificationFetch = globalThis.fetch,
  apiKey?: string
): Promise<TokenMetadata | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,12}$/.test(normalizedSymbol)) return null;

  const response = await fetchImpl(
    `https://api.jup.ag/tokens/v2/search?query=${encodeURIComponent(normalizedSymbol)}`,
    {
      method: "GET",
      headers: apiKey ? { "x-api-key": apiKey } : undefined
    }
  );

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const tokens = Array.isArray(payload) ? payload : [];
  const exactMatches = tokens.filter(
    (token) => token?.symbol?.toUpperCase() === normalizedSymbol
  );
  if (exactMatches.length !== 1) return null;

  const match = exactMatches[0];
  const mint = match.id ?? match.address ?? match.mint;
  if (typeof mint !== "string" || !SOLANA_ADDRESS_PATTERN.test(mint)) return null;

  return {
    mint,
    name: typeof match.name === "string" ? match.name : undefined,
    symbol: typeof match.symbol === "string" ? match.symbol : undefined,
    decimals: typeof match.decimals === "number" ? match.decimals : undefined,
    icon: typeof match.icon === "string" ? match.icon : undefined,
    verificationSource: "jupiter"
  };
}

export async function verifySolscanToken(
  mint: string,
  fetchImpl: TokenVerificationFetch = globalThis.fetch
): Promise<TokenMetadata | null> {
  if (!SOLANA_ADDRESS_PATTERN.test(mint)) return null;

  const response = await fetchImpl(`https://solscan.io/token/${mint}`, {
    method: "GET"
  });

  if (!response.ok) return null;

  const finalUrl = response.url || "";
  if (finalUrl && !finalUrl.includes(`/token/${mint}`)) {
    return null;
  }

  const html = await response.text();
  if (looksLikeNonTokenPage(html)) return null;

  const metadata = extractSolscanTokenMetadata(html, mint);
  if (!metadata) return null;

  return metadata;
}

export function extractSolscanTokenMetadata(
  html: string,
  mint: string
): TokenMetadata | null {
  if (!html.includes(mint)) return null;

  const title = readHtmlTitle(html);
  const titleMetadata = title ? parseTokenTitle(title) : null;
  if (titleMetadata) return titleMetadata;

  const symbol =
    readJsonString(html, "symbol") ??
    readJsonString(html, "tokenSymbol") ??
    readJsonString(html, "ticker");
  const name = readJsonString(html, "name") ?? readJsonString(html, "tokenName");

  if (!symbol && !name) return null;

  return { name, symbol, verificationSource: "solscan" };
}

function looksLikeNonTokenPage(html: string) {
  return /account\s+not\s+found/i.test(html) || /token\s+not\s+found/i.test(html);
}

function readHtmlTitle(html: string) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
}

function parseTokenTitle(title: string): TokenMetadata | null {
  const normalized = title.replace(/\s+/g, " ").trim();
  const pair = normalized.match(/^(.+?)\s+\(([A-Z0-9]{2,12})\)\s+Token\b/i);
  if (pair) {
    return {
      name: pair[1].trim(),
      symbol: pair[2].trim(),
      verificationSource: "solscan"
    };
  }

  const tokenPrefix = normalized.match(/^([A-Z0-9]{2,12})\s+Token\b/i);
  if (tokenPrefix) {
    return { symbol: tokenPrefix[1].trim(), verificationSource: "solscan" };
  }

  return null;
}

function readJsonString(html: string, key: string) {
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i"));
  return match?.[1]?.trim();
}

function mergeTokenHints(tokens: TokenHint[]) {
  const seen = new Set<string>();

  return tokens.filter((token) => {
    const key = token.mint ? `mint:${token.mint}` : `symbol:${token.symbol ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
