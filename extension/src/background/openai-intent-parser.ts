import type { DetectedContextSnapshot } from "../shared/context";
import type {
  ClarificationKind,
  ClarificationPayload,
  SIPIntent
} from "../shared/intent";

type IntentModelFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type LegacyCompletionClient = {
  chat: {
    completions: {
      create(request: unknown): Promise<AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>>;
    };
  };
};

function getDefaultFetch(): IntentModelFetch {
  return globalThis.fetch.bind(globalThis);
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

function isStrictSymbolCandidate(key: string) {
  return /^[A-Z0-9]{3,12}$/.test(key.trim().toUpperCase());
}

async function searchJupiterTokens(query: string): Promise<any[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const jupiterApiKey = process.env.PLASMO_PUBLIC_JUPITER_API_KEY;
  try {
    const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${query}`, {
      headers: jupiterApiKey ? { "x-api-key": jupiterApiKey } : undefined
    });
    if (!response.ok) return [];
    const result = await response.json();
    return Array.isArray(result) ? result : (result.data || []);
  } catch (error) {
    return [];
  }
}

async function getJupiterTokenMetadata(key: string): Promise<any | null> {
  const normalizedKey = key.toUpperCase();
  try {
    const tokens = await searchJupiterTokens(key);
    if (tokens.length > 0) {
      const found = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)
        ? tokens.find((t: any) => (t?.address || t?.mint || t?.id) === key)
        : isStrictSymbolCandidate(normalizedKey)
        ? tokens.find((t: any) => t?.symbol?.toUpperCase() === normalizedKey)
        : null;
      if (!found) return null;
      return {
          address: found.address || found.mint || found.id,
          symbol: found.symbol || key,
          decimals: typeof found.decimals === 'number' ? found.decimals : 9
      };
    }
  } catch (e) {
    console.error(e);
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
    if (matchedCandidate) return matchedCandidate.mint ?? matchedCandidate.symbol ?? null;
  }
  if (candidates.length !== 1) return null;
  return candidates[0].mint ?? candidates[0].symbol ?? null;
}

function toAtomicAmount(amount: string | number, mint: string, decimals?: number): string {
  const val = Number(amount);
  if (isNaN(val)) return "0";
  const finalDecimals = decimals ?? DECIMALS_MAP[mint] ?? 9;
  return Math.floor(val * Math.pow(10, finalDecimals)).toString();
}

async function mapToSIPIntent(raw: any, context?: DetectedContextSnapshot, userInput = "", userPublicKey?: string): Promise<SIPIntent> {
    const buyTokenRaw = String(raw.token || raw.buyToken || raw.outputMint || "USDC");
    const spendTokenRaw = String(raw.amountUnit || raw.inputToken || raw.spendToken || "SOL");
    const rawAmount = raw.amount || "0";
    const rawSwapMode = raw.swapMode === "ExactOut" || raw.amountTarget === "output" || raw.intentMode === "ExactOut" ? "ExactOut" : "ExactIn";
    const resolvedBuyTokenRaw = resolveContextTokenReference(buyTokenRaw, context, userInputUsesContextReference(userInput));
    const needsContextClarification = resolvedBuyTokenRaw === null;

    const [input, output] = await Promise.all([
        resolveToken(spendTokenRaw, context),
        resolveToken(resolvedBuyTokenRaw ?? "USDC", context)
    ]);

    const isSameToken = input.mint === output.mint;
    const needsOutputResolution = !output.mint;

    const intent: SIPIntent = {
        intentId: "ai-" + Date.now(),
        actions: [],
        mode: "SINGLE",
        metadata: {
            strategyGoal: needsContextClarification || needsOutputResolution ? "Clarification required" : isSameToken ? "Invalid Swap" : `Swap ${input.symbol} to ${output.symbol}`,
            reasoning: needsContextClarification ? "The request refers to this token, but SIP could not identify exactly one verified page token." : needsOutputResolution ? "I could not verify a unique token." : isSameToken ? "Cannot swap a token for itself." : "Swap intent parsed successfully.",
            jitoTipLamports: 1000,
            requiresRiskScan: true,
            sourceContext: buildSourceContext(context),
            needsClarification: needsContextClarification || needsOutputResolution || isSameToken
        }
    };

    intent.actions.push({
        id: "action-1",
        type: "SWAP",
        status: "pending",
        payload: {
            inputMint: input.mint,
            outputMint: output.mint,
            amount: toAtomicAmount(rawAmount, rawSwapMode === "ExactOut" ? output.mint : input.mint, rawSwapMode === "ExactOut" ? output.decimals : input.decimals),
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
            outputDecimals: output.decimals,
            userPublicKey: userPublicKey
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
  return { ...intent, metadata: { ...metadata, sourceContext: buildSourceContext(context) } };
}

function buildSystemPrompt() {
  return `You are a strict Solana trading intent parser.
Output ONLY raw JSON. Do NOT include any reasoning.
The response must be one compact JSON object with keys: token, amount, amountUnit, swapMode.
Constraint: In a SWAP, the input token (amountUnit) and output token (token) MUST NOT be the same.
Include swapMode as either "ExactIn" or "ExactOut".
Rules for amountUnit:
- If user says "buy 100 JUP", set token: "JUP", amount: 100, amountUnit: "JUP".
- If user says "buy 10 SOL of JUP", set token: "JUP", amount: 10, amountUnit: "SOL".
- If user says "swap 10 SOL to USDC", set token: "USDC", amount: 10, amountUnit: "SOL", swapMode: "ExactIn".
- If user says "buy 100 USD1 with SOL", set token: "USD1", amount: 100, amountUnit: "SOL", swapMode: "ExactOut".
- If user says "receive 100 USD1 with SOL", set token: "USD1", amount: 100, amountUnit: "SOL", swapMode: "ExactOut".`;
}

function buildUserPrompt(userInput: string, context?: DetectedContextSnapshot) {
  return `User request: ${userInput}\nContext: ${formatContextForPrompt(context)}`;
}

async function readLegacyCompletionContent(
  client: LegacyCompletionClient,
  model: string,
  userInput: string,
  context?: DetectedContextSnapshot
) {
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(userInput, context) }
    ],
    temperature: 0.1,
    max_tokens: 4096,
    stream: true
  });

  let fullContent = "";
  for await (const chunk of completion) {
    fullContent += chunk.choices?.[0]?.delta?.content || "";
  }
  return fullContent;
}

function extractResponsesText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const value = payload as any;
  if (typeof value.output_text === "string") return value.output_text;

  const output = Array.isArray(value.output) ? value.output : [];
  const messageTextParts = output
    .filter((item: any) => item?.type === "message" && item?.role === "assistant")
    .flatMap((item: any) => {
      const content = Array.isArray(item?.content) ? item.content : [];
      return content
        .filter((part: any) => part?.type === "output_text")
        .map((part: any) => part?.text)
        .filter((text: unknown): text is string => typeof text === "string");
    });

  if (messageTextParts.length) return messageTextParts.join("");
  if (typeof value.content === "string") return value.content;
  if (typeof value.text === "string") return value.text;
  return "";
}

async function readOpenRouterResponsesContent(options: {
  apiKey: string;
  model: string;
  fetchImpl: IntentModelFetch;
  baseUrl: string;
  userInput: string;
  context?: DetectedContextSnapshot;
}) {
  const response = await options.fetchImpl(`${options.baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0,
      max_output_tokens: 128,
      input: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(options.userInput, options.context) }
      ]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as any).error)
        : `OpenRouter request failed with status ${response.status}`;
    throw new Error(message);
  }

  return extractResponsesText(payload);
}

function parseModelJson(fullContent: string) {
  let jsonStr = "";
  const firstOpen = fullContent.indexOf("{");
  const lastClose = fullContent.lastIndexOf("}");
  if (firstOpen !== -1 && lastClose !== -1) jsonStr = fullContent.substring(firstOpen, lastClose + 1);
  if (!jsonStr) jsonStr = fullContent.replace(/```[a-z]*|```/gi, "").trim();

  return JSON.parse(jsonStr);
}

function parseSimpleSwapCommand(userInput: string) {
  const normalized = userInput.trim();

  const buySpendMatch = normalized.match(
    /^buy\s+([0-9]+(?:\.[0-9]+)?)\s+([A-Za-z0-9]+)\s+(?:of|for|to)\s+(.+)$/i
  );
  if (buySpendMatch) {
    return {
      token: buySpendMatch[3].trim(),
      amount: buySpendMatch[1],
      amountUnit: buySpendMatch[2].trim().toUpperCase(),
      swapMode: "ExactIn"
    };
  }

  const swapMatch = normalized.match(
    /^swap\s+([0-9]+(?:\.[0-9]+)?)\s+([A-Za-z0-9]+)\s+(?:to|for)\s+(.+)$/i
  );
  if (swapMatch) {
    return {
      token: swapMatch[3].trim(),
      amount: swapMatch[1],
      amountUnit: swapMatch[2].trim().toUpperCase(),
      swapMode: "ExactIn"
    };
  }

  const buyOutputWithInputMatch = normalized.match(
    /^buy\s+([0-9]+(?:\.[0-9]+)?)\s+([A-Za-z0-9]+)\s+with\s+([A-Za-z0-9]+)$/i
  );
  if (buyOutputWithInputMatch) {
    return {
      token: buyOutputWithInputMatch[2].trim().toUpperCase(),
      amount: buyOutputWithInputMatch[1],
      amountUnit: buyOutputWithInputMatch[3].trim().toUpperCase(),
      swapMode: "ExactOut"
    };
  }

  return null;
}

export function createOpenAIIntentParser(options?: {
  apiKey?: string;
  model?: string;
  client?: LegacyCompletionClient;
  fetchImpl?: IntentModelFetch;
  baseUrl?: string;
}) {
  const apiKey =
    options?.apiKey ??
    process.env.PLASMO_PUBLIC_OPENROUTER_API_KEY ??
    process.env.OPENROUTER_API_KEY;
  const model = options?.model ?? process.env.PLASMO_PUBLIC_OPENROUTER_MODEL ?? "openai/gpt-oss-120b:free";
  const fetchImpl = options?.fetchImpl ?? getDefaultFetch();
  const baseUrl = options?.baseUrl ?? "https://openrouter.ai/api/v1";

  return {
    async parseIntent(
      userInput: string,
      context?: DetectedContextSnapshot,
      userPublicKey?: string
    ): Promise<SIPIntent> {
      if (userInputUsesContextReference(userInput)) {
        return createContextTokenConfirmationIntent(userInput, context);
      }

      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY is not configured");
      }

      const fullContent = options?.client
        ? await readLegacyCompletionContent(options.client, model, userInput, context)
        : await readOpenRouterResponsesContent({
            apiKey,
            model,
            fetchImpl,
            baseUrl,
            userInput,
            context
          });

      try {
        const parsed = parseModelJson(fullContent);
        
        // 防呆拦截：如果 AI 犯傻返回了相同的代币，强制抛出异常走降级逻辑
        const aiToken = String(parsed.token || parsed.buyToken || parsed.outputMint || "USDC").toUpperCase();
        const aiAmountUnit = String(parsed.amountUnit || parsed.inputToken || parsed.spendToken || "SOL").toUpperCase();
        
        if (aiToken === aiAmountUnit) {
            console.warn("[AI] Model hallucinated identical input/output tokens. Forcing fallback.");
            throw new Error("AI hallucinated identical tokens");
        }

        const mapped = await mapToSIPIntent(parsed, context, userInput, userPublicKey);
        return normalizeIntentWithContext(mapped, context, userInput);
      } catch (e) {
        console.warn("[AI] Falling back to regex parser due to invalid AI output or hallucination.");
        const fallback = parseSimpleSwapCommand(userInput);
        if (fallback) {
          const mapped = await mapToSIPIntent(fallback, context, userInput, userPublicKey);
          return normalizeIntentWithContext(mapped, context, userInput);
        }

        console.error("[AI] Failed to parse JSON. Raw:", fullContent);
        throw new Error("AI output was not valid JSON");
      }
    }
  };
}
