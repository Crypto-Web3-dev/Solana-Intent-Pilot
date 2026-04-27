import OpenAI from "openai";
import type { DetectedContextSnapshot } from "../shared/context";
import type {
  ClarificationKind,
  ClarificationPayload,
  SIPIntent
} from "../shared/intent";

type OpenAIResponseIntent = {
  intent: SIPIntent["intent"];
  confidence: number;
  payload: SIPIntent["payload"];
  metadata: SIPIntent["metadata"];
};

function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
    dangerouslyAllowBrowser: true
  });
}

export function formatContextForPrompt(context?: DetectedContextSnapshot) {     
  if (!context) {
    return "No page context was available.";
  }

  const detectedTokens = context.detectedTokens.length
    ? context.detectedTokens
        .map((token) => {
          const tokenId = token.mint ?? token.symbol ?? "unknown";
          const label = [token.symbol, token.name].filter(Boolean).join(" ");
          const decimals = token.decimals === undefined ? "" : `:decimals=${token.decimals}`;
          const verified = token.verified ? ":verified" : "";
          return `${token.source}:${tokenId}:${token.confidence}${verified}${decimals}${label ? `:${label}` : ""}`;
        })
        .join(", ")
    : "none";
  const rawHints = context.rawHints.length ? context.rawHints.join(", ") : "none";

  return [
    `Page URL: ${context.url}`,
    `Page Title: ${context.title}`,
    `Selected Text: ${context.selectedText ?? "none"}`,
    `Raw Hints: ${rawHints}`,
    `Detected Tokens: ${detectedTokens}`
  ].join("\n");
}

function hasMultipleTokenCandidates(context?: DetectedContextSnapshot) {        
  return (context?.detectedTokens.length ?? 0) > 1;
}

function hasExplicitTokenMention(userInput: string) {
  const normalized = userInput.toLowerCase().trim();
  if (normalized.includes("this") || normalized.includes("that")) {
    return false;
  }
  const keywords = ["buy", "swap", "trade", "sell", "of", "to", "for", "with"]; 
  const words = normalized.split(/\s+/);
  return words.some(w => !keywords.includes(w) && (/\$[a-z0-9]+|\b[a-z0-9]{3,}\b/i.test(w)));
}

function isContextPronoun(value: string) {
  return ["this", "that", "it", "token", "this token", "that token"].includes(
    value.trim().toLowerCase()
  );
}

function userInputUsesContextReference(userInput: string) {
  return /\b(this|that|it)\b/i.test(userInput);
}

function buildClarificationMessage(kind: ClarificationKind) {
  switch (kind) {
    case "missing-output-mint":
      return "I still need to know which token you want.";
    case "unknown-output-mint":
      return "I found token hints, but not enough to safely identify one token.";
    case "ambiguous-output-mint":
      return "I found multiple possible token candidates.";
    case "underspecified-request":
      return "I need a more specific request before I can continue.";
  }
}

function buildClarificationPayload(
  context: DetectedContextSnapshot | undefined,
  userInput: string
): ClarificationPayload | undefined {
  const normalizedInput = userInput.trim().toLowerCase();
  const isGeneric = normalizedInput === "buy" || normalizedInput === "swap" || normalizedInput === "trade" || normalizedInput === "buy this" || normalizedInput === "swap this";
  const hasTokens = (context?.detectedTokens.length ?? 0) > 0;

  if (hasMultipleTokenCandidates(context) && !hasExplicitTokenMention(userInput)) {
    return {
      kind: "ambiguous-output-mint",
      message: buildClarificationMessage("ambiguous-output-mint"),
      candidateSymbols: (context?.detectedTokens ?? [])
        .map((token) => token.symbol)
        .filter((symbol): symbol is string => Boolean(symbol))
    };
  }

  if (isGeneric && !hasTokens) {
    const hasHints = (context?.rawHints.length ?? 0) > 0;
    return {
      kind: hasHints ? "unknown-output-mint" : "missing-output-mint",
      message: buildClarificationMessage(hasHints ? "unknown-output-mint" : "missing-output-mint")
    };
  }

  if (isGeneric || (!hasExplicitTokenMention(userInput) && hasTokens)) {        
      return {
          kind: "underspecified-request",
          message: buildClarificationMessage("underspecified-request")
      };
  }

  return undefined;
}

function uniqueCandidateSymbols(context?: DetectedContextSnapshot) {
  const symbols = (context?.detectedTokens ?? [])
    .map((token) => token.symbol)
    .filter((symbol): symbol is string => Boolean(symbol));

  return Array.from(new Set(symbols)).slice(0, 8);
}

function createContextTokenConfirmationIntent(
  userInput: string,
  context?: DetectedContextSnapshot
): SIPIntent {
  const candidateSymbols = uniqueCandidateSymbols(context);
  const hasCandidates = candidateSymbols.length > 0;

  return {
    intentId: "clarify-" + Date.now(),
    mode: "SINGLE",
    actions: [
      {
        id: "action-1",
        type: "SWAP",
        status: "pending",
        payload: {
          inputMint: "So11111111111111111111111111111111111111112",
          outputMint: "",
          amount: "0",
          amountMode: "exact",
          platform: "Jupiter",
          inputSymbol: "SOL"
        }
      }
    ],
    metadata: {
      strategyGoal: "Confirm token",
      reasoning: hasCandidates
        ? "Please confirm which page token you want to use before SIP checks Jupiter or prepares execution."
        : "The request refers to this token, but SIP could not find token candidates on the current page.",
      jitoTipLamports: 0,
      requiresRiskScan: false,
      sourceContext: buildSourceContext(context),
      needsClarification: true,
      clarification: {
        kind: hasCandidates ? "ambiguous-output-mint" : "unknown-output-mint",
        message: hasCandidates
          ? "Confirm the output token before continuing."
          : "I found page hints, but no token candidate to confirm.",
        candidateSymbols
      }
    }
  };
}

function buildSourceContext(context?: DetectedContextSnapshot) {
  const sourceContext = ["user-input"];
  if (!context) return sourceContext;
  if (context.url) sourceContext.push("page-url");
  if (context.selectedText) sourceContext.push("selected-text");
  if (context.detectedTokens.length > 0) sourceContext.push("detected-token");  
  return sourceContext;
}

const MINT_MAP: Record<string, string> = {
  "SOL": "So11111111111111111111111111111111111111112",
  "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "BONK": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
};

const DECIMALS_MAP: Record<string, number> = {
  "So11111111111111111111111111111111111111112": 9,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": 6,
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": 6,
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": 5
};

let tokenListCache: {
  bySymbol: Map<string, any>;
  byAddress: Map<string, any>;
} | null = null;
const tokenSearchCache = new Map<string, any[]>();

function isStrictSymbolCandidate(key: string) {
  return /^[A-Z0-9]{3,12}$/.test(key.trim().toUpperCase());
}

function formatClarificationCandidate(token: {
  symbol?: string;
  name?: string;
  mint?: string;
}) {
  const symbol = token.symbol?.trim();
  const mint = token.mint?.trim();
  if (!symbol || !mint) return null;
  const name = token.name?.trim() || "Unknown token";
  return `${symbol} | ${name} | ${mint}`;
}

function rememberTokenMetadata(metadata: {
  address: string;
  symbol: string;
  decimals?: number;
  name?: string;
  icon?: string;
}) {
  if (!tokenListCache) {
    tokenListCache = { bySymbol: new Map(), byAddress: new Map() };
  }

  tokenListCache.bySymbol.set(metadata.symbol.toUpperCase(), metadata);
  tokenListCache.byAddress.set(metadata.address, metadata);
}

async function searchJupiterExactSymbolCandidates(symbol: string): Promise<
  Array<{
    mint: string;
    symbol: string;
    name?: string;
    decimals?: number;
    icon?: string;
  }>
> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!isStrictSymbolCandidate(normalizedSymbol)) return [];
  const tokens = await searchJupiterTokens(symbol);

  return tokens
    .filter((token: any) => typeof token?.symbol === "string" && token.symbol.toUpperCase() === normalizedSymbol)
    .map((token: any) => ({
      mint: token.id ?? token.address ?? token.mint,
      symbol: token.symbol,
      name: typeof token.name === "string" ? token.name : undefined,
      decimals: typeof token.decimals === "number" ? token.decimals : undefined,
      icon: typeof token.icon === "string" ? token.icon : undefined
    }))
    .filter((token) => typeof token.mint === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(token.mint))
    .map((token) => {
      rememberTokenMetadata({
        address: token.mint,
        symbol: token.symbol,
        decimals: token.decimals,
        name: token.name,
        icon: token.icon
      });
      return token;
    });
}

async function searchJupiterTokens(query: string): Promise<any[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  if (tokenSearchCache.has(normalizedQuery)) {
    return tokenSearchCache.get(normalizedQuery) ?? [];
  }

  const jupiterApiKey = process.env.PLASMO_PUBLIC_JUPITER_API_KEY;

  try {
    const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${query}`, {
      headers: jupiterApiKey ? { "x-api-key": jupiterApiKey } : undefined
    });

    if (!response.ok) {
      tokenSearchCache.set(normalizedQuery, []);
      return [];
    }

    const result = await response.json();
    const tokens = Array.isArray(result) ? result : (result.data || []);
    tokenSearchCache.set(normalizedQuery, tokens);
    return tokens;
  } catch (error) {
    console.error("[AI Token Resolver] Candidate search exception:", error);
    tokenSearchCache.set(normalizedQuery, []);
    return [];
  }
}

async function getJupiterTokenMetadata(key: string): Promise<any | null> {      
  const normalizedKey = key.toUpperCase();
  const jupiterApiKey = process.env.PLASMO_PUBLIC_JUPITER_API_KEY;

  if (tokenListCache) {
    const cached = tokenListCache.bySymbol.get(normalizedKey) || tokenListCache.byAddress.get(key);
    if (cached) return cached;
  }

  try {
    const tokens = await searchJupiterTokens(key);
    if (tokens.length > 0) {
      const found = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)
        ? tokens.find((t: any) => {
            const mint = t?.address || t?.mint || t?.id;
            return typeof mint === "string" && mint === key;
          })
        : isStrictSymbolCandidate(normalizedKey)
        ? (() => {
            const exactMatches = tokens.filter(
              (t: any) => typeof t?.symbol === "string" && t.symbol.toUpperCase() === normalizedKey
            );
            return exactMatches.length === 1 ? exactMatches[0] : null;
          })()
        : null;

      if (!found) {
        return null;
      }

      const address = found.address || found.mint || found.id;

      if (address) {
        const metadata = {
          address: address,
          symbol: found.symbol || key,
          decimals: typeof found.decimals === 'number' ? found.decimals : 9   
        };

        rememberTokenMetadata(metadata);

        return metadata;
      }
    }
  } catch (e) {
    console.error("[AI Token Resolver] Fetch Exception:", e);
  }
  return null;
}

async function resolveToken(
  symbolOrMint: string,
  context?: DetectedContextSnapshot
): Promise<{
  mint: string;
  decimals: number;
  symbol: string;
  name?: string;
  verified?: boolean;
  verificationSource?: "jupiter" | "solscan";
  icon?: string;
}> {
  const normalized = symbolOrMint.toUpperCase();

  if (context?.detectedTokens) {
    const found = context.detectedTokens.find(
      (t) => t.symbol?.toUpperCase() === normalized || t.mint === symbolOrMint
    );
    if (found && found.mint) return {
      mint: found.mint,
      decimals: found.decimals ?? 9,
      symbol: found.symbol || normalized,
      name: found.name,
      verified: found.verified,
      verificationSource: found.verificationSource,
      icon: found.icon
    };
  }
  
  if (MINT_MAP[normalized]) {
    const mint = MINT_MAP[normalized];
    return { mint, decimals: DECIMALS_MAP[mint] ?? 9, symbol: normalized };
  }

  if (tokenListCache?.byAddress.has(symbolOrMint)) {
    const cachedByAddress = tokenListCache.byAddress.get(symbolOrMint);
    return {
      mint: cachedByAddress.address,
      decimals: typeof cachedByAddress.decimals === "number" ? cachedByAddress.decimals : 9,
      symbol: cachedByAddress.symbol || symbolOrMint.slice(0, 4),
      name: cachedByAddress.name,
      icon: cachedByAddress.icon
    };
  }

  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(symbolOrMint)) {
    return { mint: symbolOrMint, decimals: 9, symbol: symbolOrMint.slice(0, 4) };
  }

  const official = await getJupiterTokenMetadata(symbolOrMint);
  if (official) return { mint: official.address, decimals: official.decimals, symbol: official.symbol }; 
  return { mint: "", decimals: 9, symbol: normalized };
}

function resolveContextTokenReference(
  rawToken: string,
  context?: DetectedContextSnapshot,
  forceContextReference = false
): string | null {
  if (!forceContextReference && !isContextPronoun(rawToken)) return rawToken;

  const candidates = (context?.detectedTokens ?? []).filter(
    (token) => token.verified && (token.mint || token.symbol)
  );

  if (forceContextReference && !isContextPronoun(rawToken)) {
    const normalizedRawToken = rawToken.trim().toUpperCase();
    const matchedCandidate = candidates.find(
      (token) =>
        token.symbol?.toUpperCase() === normalizedRawToken ||
        token.name?.toUpperCase() === normalizedRawToken ||
        token.mint === rawToken
    );

    if (matchedCandidate) {
      return matchedCandidate.mint ?? matchedCandidate.symbol ?? null;
    }
  }

  if (candidates.length !== 1) {
    return null;
  }

  return candidates[0].mint ?? candidates[0].symbol ?? null;
}

function toAtomicAmount(amount: string | number, mint: string, decimals?: number): string {
  const val = Number(amount);
  if (isNaN(val)) return "0";
  const finalDecimals = decimals ?? DECIMALS_MAP[mint] ?? 9;
  return Math.floor(val * Math.pow(10, finalDecimals)).toString();
}

async function mapToSIPIntent(raw: any, context?: DetectedContextSnapshot, userInput = ""): Promise<SIPIntent> {
    const buyTokenRaw = String(raw.token || raw.buyToken || raw.outputMint || "USDC");
    const spendTokenRaw = String(raw.amountUnit || raw.inputToken || raw.spendToken || "SOL");
    const rawAmount = raw.amount || "0";
    const rawSwapMode =
      raw.swapMode === "ExactOut" || raw.amountTarget === "output" || raw.intentMode === "ExactOut"
        ? "ExactOut"
        : "ExactIn";
    const resolvedBuyTokenRaw = resolveContextTokenReference(
      buyTokenRaw,
      context,
      userInputUsesContextReference(userInput)
    );
    const needsContextClarification = resolvedBuyTokenRaw === null;

    // 核心改进：先解析代币，再动态生成目标和推理
    const [input, output] = await Promise.all([
        resolveToken(spendTokenRaw, context),
        resolveToken(resolvedBuyTokenRaw ?? "USDC", context)
    ]);

    const isSameToken = input.mint === output.mint;
    const hasResolvedOutputMint = Boolean(output.mint);
    const needsOutputResolution = !hasResolvedOutputMint;
    const ambiguousOutputCandidates =
      needsOutputResolution && isStrictSymbolCandidate(output.symbol)
        ? await searchJupiterExactSymbolCandidates(output.symbol)
        : [];
    const ambiguousOutputCandidateLabels = ambiguousOutputCandidates
      .map((candidate) =>
        formatClarificationCandidate({
          symbol: candidate.symbol,
          name: candidate.name,
          mint: candidate.mint
        })
      )
      .filter((candidate): candidate is string => Boolean(candidate))
      .slice(0, 8);

    const intent: SIPIntent = {
        intentId: "ai-" + Date.now(),
        actions: [],
        mode: "SINGLE",
        metadata: {
            strategyGoal: needsContextClarification || needsOutputResolution ? "Clarification required" : isSameToken ? "Invalid Swap" : `Swap ${input.symbol} to ${output.symbol}`,
            reasoning: needsContextClarification
                ? "The request refers to this token, but SIP could not identify exactly one verified page token."
                : needsOutputResolution
                ? ambiguousOutputCandidateLabels.length > 0
                  ? `SIP found multiple verified matches for ${output.symbol}. Please confirm the intended token by name and mint address.`
                  : `SIP could not uniquely verify the token symbol ${output.symbol}. Please provide a more specific token name or mint address.`
                : isSameToken 
                ? `You requested to swap ${input.symbol} for itself, which is not a valid transaction. Please select a different target token.`
                : rawSwapMode === "ExactOut"
                ? `Executing a decentralized exchange swap. Receiving ${rawAmount || "the requested amount"} ${output.symbol} by spending ${input.symbol} based on your input command.`
                : `Executing a decentralized exchange swap. Trading ${rawAmount || 'an optimal amount'} ${input.symbol} for ${output.symbol} based on your input command.`,
            jitoTipLamports: 1000,
            requiresRiskScan: true,
            sourceContext: ["user-input"],
            needsClarification: needsContextClarification || needsOutputResolution || isSameToken,
            clarification:
              !needsContextClarification && needsOutputResolution
                ? {
                    kind: ambiguousOutputCandidateLabels.length > 0
                      ? "ambiguous-output-mint"
                      : "unknown-output-mint",
                    message: ambiguousOutputCandidateLabels.length > 0
                      ? `Choose which ${output.symbol} token you want.`
                      : `I could not verify a unique token for ${output.symbol}.`,
                    candidateSymbols: ambiguousOutputCandidateLabels
                  }
                : undefined
        }
    };

    intent.actions.push({
        id: "action-1",
        type: "SWAP",
        status: "pending",
        payload: {
            inputMint: input.mint,
            outputMint: output.mint,
            amount: toAtomicAmount(
              rawAmount,
              rawSwapMode === "ExactOut" ? output.mint : input.mint,
              rawSwapMode === "ExactOut" ? output.decimals : input.decimals
            ),
            amountMode: "exact",
            swapMode: rawSwapMode,
            platform: "Jupiter",
            slippageBps: 50,
            inputSymbol: input.symbol,
            outputSymbol: output.symbol,
            outputTokenName: output.name,
            outputTokenVerified: output.verified,
            outputTokenVerificationSource: output.verificationSource,
            outputTokenIcon: output.icon,
            inputDecimals: input.decimals,
            outputDecimals: output.decimals
        }
    });

    return intent;
}

export function normalizeIntentWithContext(
  intent: SIPIntent,
  context?: DetectedContextSnapshot,
  userInput = ""
): SIPIntent {
  const metadata = intent.metadata || {
    strategyGoal: "Generated intent",
    reasoning: "Generated intent.",
    requiresRiskScan: true,
    sourceContext: [],
    needsClarification: false
  };

  const resolvedMint = intent.actions?.[0]?.payload?.outputMint;
  const isSOL = resolvedMint === MINT_MAP["SOL"];
  const hasVerifiedOutputCandidate = Boolean(
    resolvedMint &&
    context?.detectedTokens.some(
      (token) => token.verified && token.mint === resolvedMint
    )
  );
  const hasStrongEvidence = !isSOL && resolvedMint && resolvedMint.length > 30; 

  const normalizedInput = userInput.trim().toLowerCase();
  const isGeneric = normalizedInput === "buy" || normalizedInput === "swap" || normalizedInput === "trade" || normalizedInput === "buy this" || normalizedInput === "swap this";

  const needsClarification =
    (metadata.needsClarification ?? false) ||
    (hasMultipleTokenCandidates(context) &&
      !hasVerifiedOutputCandidate &&
      (!hasStrongEvidence || !hasExplicitTokenMention(userInput))) ||
    isGeneric;

  const clarification = needsClarification
    ? metadata.clarification ?? buildClarificationPayload(context, userInput)
    : undefined;

  return {
    ...intent,
    metadata: {
      ...metadata,
      reasoning: metadata.reasoning || "Resolved intent with context.",
      requiresRiskScan: true,
      needsClarification,
      clarification,
      sourceContext: buildSourceContext(context)
    }
  };
}

export function createOpenAIIntentParser(options?: {
  apiKey?: string;
  model?: string;
  client?: OpenAI;
}) {
  const apiKey = options?.apiKey ?? process.env.PLASMO_PUBLIC_NVIDIA_API_KEY;   
  const model = options?.model ?? "z-ai/glm-5.1";

  const client = options?.client ?? new OpenAI({
    apiKey: apiKey || "",
    baseURL: 'https://integrate.api.nvidia.com/v1',
    dangerouslyAllowBrowser: true
  });

  return {
    async parseIntent(
      userInput: string,
      context?: DetectedContextSnapshot
    ): Promise<SIPIntent> {
      if (userInputUsesContextReference(userInput)) {
        return createContextTokenConfirmationIntent(userInput, context);
      }

      if (!apiKey) {
        throw new Error("NVIDIA_API_KEY is not configured");
      }

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              `You are a strict Solana trading intent parser.
        Output ONLY raw JSON. Do NOT include any reasoning.
        Constraint: In a SWAP, the input token (amountUnit) and output token (token) MUST NOT be the same.
        Include swapMode as either "ExactIn" or "ExactOut".
        Rules for amountUnit:
        - If user says "buy 100 JUP", set token: "JUP", amount: 100, amountUnit: "JUP".      
        - If user says "buy 10 SOL of JUP", set token: "JUP", amount: 10, amountUnit: "SOL". 
        - If user says "swap 10 SOL to USDC", set token: "USDC", amount: 10, amountUnit: "SOL", swapMode: "ExactIn".
        - If user says "buy 100 USD1 with SOL", set token: "USD1", amount: 100, amountUnit: "SOL", swapMode: "ExactOut".
        - If user says "receive 100 USD1 with SOL", set token: "USD1", amount: 100, amountUnit: "SOL", swapMode: "ExactOut".`
          },          { role: "user", content: `User request: ${userInput}\nContext: ${formatContextForPrompt(context)}` }
        ],
        temperature: 0.1,
        max_tokens: 4096,
        stream: true
      });

      let fullContent = "";
      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullContent += content;
      }

      try {
        let jsonStr = "";
        const firstOpen = fullContent.indexOf('{');
        const lastClose = fullContent.lastIndexOf('}');
        if (firstOpen !== -1 && lastClose !== -1) jsonStr = fullContent.substring(firstOpen, lastClose + 1);
        if (!jsonStr) jsonStr = fullContent.replace(/```[a-z]*|```/gi, "").trim();

        const parsed = JSON.parse(jsonStr);
        const mapped = await mapToSIPIntent(parsed, context, userInput);
        return normalizeIntentWithContext(mapped, context, userInput);
      } catch (e) {
        console.error("[AI] Failed to parse JSON. Raw:", fullContent);
        throw new Error("AI output was not valid JSON");
      }
    }
  };
}
