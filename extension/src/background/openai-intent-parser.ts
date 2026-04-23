import OpenAI from "openai";
import type { DetectedContextSnapshot } from "../shared/context";
import type {
  ClarificationKind,
  ClarificationPayload,
  SIPIntent,
  SIPAction
} from "../shared/intent";

type OpenAIResponseIntent = SIPIntent;

type ContextStrength = "weak" | "medium" | "strong";
type MintEvidenceStrength = "weak" | "medium" | "strong";

function createClient(apiKey: string) {
  return new OpenAI({
    apiKey,
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
          return `${token.source}:${tokenId}:${token.confidence}`;
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

function getContextStrength(
  context?: DetectedContextSnapshot
): ContextStrength {
  if (!context) {
    return "weak";
  }

  const hasSelectedText = Boolean(context.selectedText?.trim());
  const hasSingleToken = context.detectedTokens.length === 1;

  if (hasSelectedText && hasSingleToken) {
    return "strong";
  }

  if (context.detectedTokens.length > 0 || context.rawHints.length > 0) {
    return "medium";
  }

  return "weak";
}

function getMintEvidenceStrength(
  context?: DetectedContextSnapshot
): MintEvidenceStrength {
  if (!context) {
    return "weak";
  }

  const hasSelectedText = Boolean(context.selectedText?.trim());
  const singleToken = context.detectedTokens.length === 1;

  if (hasSelectedText && singleToken) {
    return "strong";
  }

  if (singleToken || context.rawHints.length > 0) {
    return "medium";
  }

  return "weak";
}

function isUnderspecifiedRequest(userInput: string) {
  const normalized = userInput.trim().toLowerCase();
  return ["buy", "sell", "swap", "do it", "go"].includes(normalized);
}

function isContextDependentRequest(userInput: string) {
  const normalized = userInput.toLowerCase();
  return normalized.includes("this") || normalized.includes("that");
}

function hasMultipleTokenCandidates(context?: DetectedContextSnapshot) {
  return (context?.detectedTokens.length ?? 0) > 1;
}

function hasExplicitTokenMention(userInput: string) {
  const normalized = userInput.toLowerCase();
  if (normalized.includes("this") || normalized.includes("that")) {
    return false;
  }

  return /\$[a-z0-9]+|\b[a-z0-9]{3,}\b/i.test(userInput);
}

function hasOnlyWeakMintProvenance(
  context?: DetectedContextSnapshot,
  userInput = ""
) {
  if (!context) {
    return true;
  }

  const explicitTokenMention = hasExplicitTokenMention(userInput);
  const hasSelectedText = Boolean(context.selectedText?.trim());
  const hasDetectedToken = context.detectedTokens.length > 0;

  return !explicitTokenMention && !hasSelectedText && !hasDetectedToken;
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
  const multipleTokenCandidates = hasMultipleTokenCandidates(context);
  const explicitRequestIsUnderspecified = isUnderspecifiedRequest(userInput);
  const hasCandidateTokens = (context?.detectedTokens.length ?? 0) > 0;
  const hasWeakHints = (context?.rawHints.length ?? 0) > 0;
  const hasSelectedText = Boolean(context?.selectedText?.trim());

  if (multipleTokenCandidates) {
    return {
      kind: "ambiguous-output-mint",
      message: buildClarificationMessage("ambiguous-output-mint"),
      candidateSymbols: (context?.detectedTokens ?? [])
        .map((token) => token.symbol)
        .filter((symbol): symbol is string => Boolean(symbol))
    };
  }

  if (explicitRequestIsUnderspecified) {
    if (hasCandidateTokens || hasWeakHints || hasSelectedText) {
      return {
        kind: "underspecified-request",
        message: buildClarificationMessage("underspecified-request")
      };
    }

    return {
      kind: "missing-output-mint",
      message: buildClarificationMessage("missing-output-mint")
    };
  }

  if (!hasCandidateTokens && !hasWeakHints && !hasSelectedText) {
    return {
      kind: "missing-output-mint",
      message: buildClarificationMessage("missing-output-mint")
    };
  }

  if (hasWeakHints && !hasCandidateTokens) {
    return {
      kind: "unknown-output-mint",
      message: buildClarificationMessage("unknown-output-mint")
    };
  }

  if (hasOnlyWeakMintProvenance(context, userInput)) {
    return {
      kind: "unknown-output-mint",
      message: buildClarificationMessage("unknown-output-mint")
    };
  }

  return undefined;
}

function buildSourceContext(context?: DetectedContextSnapshot) {
  const sourceContext = ["user-input"];

  if (!context) {
    return sourceContext;
  }

  if (context.url) {
    sourceContext.push("page-url");
  }
  if (context.title) {
    sourceContext.push("page-title");
  }
  if (context.selectedText) {
    sourceContext.push("selected-text");
  }
  if (context.rawHints.length > 0) {
    sourceContext.push("raw-hints");
  }
  if (context.detectedTokens.length > 0) {
    sourceContext.push("detected-token");
  }

  return sourceContext;
}

export function normalizeIntentWithContext(
  intent: SIPIntent,
  context?: DetectedContextSnapshot,
  userInput = ""
): SIPIntent {
  const multipleTokenCandidates = hasMultipleTokenCandidates(context);
  const weakMintProvenance = hasOnlyWeakMintProvenance(context, userInput);
  const mintNeedsClarification =
    multipleTokenCandidates ||
    (isContextDependentRequest(userInput) && getMintEvidenceStrength(context) === "weak") ||
    weakMintProvenance;
  const needsClarification =
    intent.metadata.needsClarification ||
    isUnderspecifiedRequest(userInput) ||
    mintNeedsClarification;

  const clarification = needsClarification
    ? buildClarificationPayload(context, userInput)
    : undefined;

  return {
    ...intent,
    metadata: {
      ...intent.metadata,
      needsClarification,
      clarification,
      sourceContext: buildSourceContext(context)
    }
  };
}

export function createOpenAIIntentParser(options?: {
  client?: OpenAI;
  apiKey?: string;
  model?: string;
}) {
  const env = (globalThis as typeof globalThis & {
    process?: { env: Record<string, string | undefined> };
  }).process?.env;
  const apiKey = options?.apiKey ?? env?.OPENAI_API_KEY;
  const model = options?.model ?? env?.OPENAI_MODEL ?? "gpt-5.4-mini";
  const client = options?.client ?? (apiKey ? createClient(apiKey) : null);

  return {
    async parseIntent(
      userInput: string,
      context?: DetectedContextSnapshot
    ): Promise<SIPIntent> {
      if (!client) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const response = await client.responses.create({
        model,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You convert user trading requests into a valid SIPIntent JSON object. You can decompose complex requests into multiple actions (e.g., Swap then Stake). Use page context as supporting evidence only. Do not invent missing fields. Return only valid JSON that matches the schema."
          },
          {
            role: "user",
            content: `User request:\n${userInput}`
          },
          {
            role: "user",
            content: `Page context:\n${formatContextForPrompt(context)}`
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "sip_intent",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["intentId", "actions", "mode", "metadata"],
              properties: {
                intentId: { type: "string" },
                mode: {
                  type: "string",
                  enum: ["ATOMIC_BUNDLE", "SINGLE"]
                },
                actions: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "type", "payload", "status"],
                    properties: {
                      id: { type: "string" },
                      type: {
                        type: "string",
                        enum: ["SWAP", "STAKE", "LEND", "TRANSFER"]
                      },
                      payload: { type: "object" },
                      status: {
                        type: "string",
                        enum: ["pending", "ready", "failed"]
                      }
                    }
                  }
                },
                metadata: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "strategyGoal",
                    "estimatedNetChange",
                    "jitoTipLamports",
                    "reasoning",
                    "sourceContext",
                    "needsClarification"
                  ],
                  properties: {
                    strategyGoal: { type: "string" },
                    estimatedNetChange: { type: "object" },
                    jitoTipLamports: { type: "number" },
                    reasoning: { type: "string" },
                    sourceContext: {
                      type: "array",
                      items: { type: "string" }
                    },
                    needsClarification: { type: "boolean" }
                  }
                }
              }
            }
          }
        }
      });

      const content = response.output_text.trim();
      const parsed = JSON.parse(content) as OpenAIResponseIntent;
      
      return normalizeIntentWithContext(parsed, context, userInput);
    }
  };
}
