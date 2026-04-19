import { describe, expect, it, vi } from "vitest";
import {
  createOpenAIIntentParser,
  formatContextForPrompt,
  normalizeIntentWithContext
} from "../../src/background/openai-intent-parser";
import type { SIPIntent } from "../../src/shared/intent";
import type { DetectedContextSnapshot } from "../../src/shared/context";

const validIntent: SIPIntent = {
  intent: "SWAP",
  confidence: 0.92,
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6fP4H4oL8nHeLqPm",
    amount: "1000000000",
    amountMode: "exact",
    slippageBps: 50,
    platform: "Jupiter"
  },
  metadata: {
    reasoning: "Swap SOL into BONK using page context.",
    requiresRiskScan: true,
    sourceContext: ["page-token", "selected-text"],
    needsClarification: false
  }
};

const contextSnapshot: DetectedContextSnapshot = {
  tabId: 2,
  url: "https://x.com/some-post",
  title: "A post on X",
  selectedText: "buy this token",
  rawHints: ["buy", "bonk", "jupiter"],
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    }
  ],
  detectedAt: "2026-04-19T00:00:00.000Z"
};

const ambiguousContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    }
  ]
};

const multiTokenContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  detectedTokens: [
    {
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    },
    {
      symbol: "WIF",
      source: "twitter",
      confidence: 0.82
    }
  ]
};

const weakMintContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [],
  rawHints: ["moon", "buy"]
};

const noMintContext: DetectedContextSnapshot = {
  ...contextSnapshot,
  selectedText: undefined,
  detectedTokens: [],
  rawHints: []
};

describe("openai intent parser", () => {
  it("includes structured page context in the OpenAI request", async () => {
    const responsesCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify(validIntent)
    });

    const parser = createOpenAIIntentParser({
      client: { responses: { create: responsesCreate } } as never,
      apiKey: "test-key"
    });

    await parser.parseIntent("buy 1 SOL of this", contextSnapshot);

    expect(responsesCreate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(responsesCreate.mock.calls[0][0].input)).toContain("x.com");
    expect(JSON.stringify(responsesCreate.mock.calls[0][0].input)).toContain("BONK");
  });

  it("still works when no context snapshot is provided", async () => {
    const responsesCreate = vi.fn().mockResolvedValue({
      output_text: JSON.stringify(validIntent)
    });

    const parser = createOpenAIIntentParser({
      client: { responses: { create: responsesCreate } } as never,
      apiKey: "test-key"
    });

    const result = await parser.parseIntent("buy 1 SOL of this");

    expect(result.intent).toBe("SWAP");
  });

  it("formats context into a stable summary block", () => {
    const summary = formatContextForPrompt(contextSnapshot);

    expect(summary).toContain("Page URL:");
    expect(summary).toContain("Selected Text:");
    expect(summary).toContain("Detected Tokens:");
  });

  it("keeps high confidence for a specific request with strong context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.94,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.confidence).toBe(0.94);
    expect(normalized.metadata.needsClarification).toBe(false);
    expect(normalized.metadata.sourceContext).toContain("user-input");
    expect(normalized.metadata.sourceContext).toContain("detected-token");
  });

  it("caps confidence for context-dependent requests with only medium certainty", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.93,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      ambiguousContext,
      "buy this"
    );

    expect(normalized.confidence).toBeLessThan(0.85);
  });

  it("requires clarification when multiple token candidates exist", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.88,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.confidence).toBeLessThan(0.5);
  });

  it("requires clarification for extremely underspecified requests", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.9,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.confidence).toBeLessThan(0.5);
  });

  it("keeps a resolved outputMint when explicit intent matches strong single-token context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.94,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.payload.outputMint).toBe(validIntent.payload.outputMint);
    expect(normalized.metadata.needsClarification).toBe(false);
  });

  it("keeps a candidate outputMint but caps confidence for context-dependent medium evidence", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.93,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      ambiguousContext,
      "buy this"
    );

    expect(normalized.payload.outputMint).toBe(validIntent.payload.outputMint);
    expect(normalized.confidence).toBeLessThan(0.85);
  });

  it("requires clarification when multiple token candidates could justify outputMint", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.9,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.confidence).toBeLessThan(0.5);
  });

  it("requires clarification when outputMint is supported only by weak page hints", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.89,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      weakMintContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.confidence).toBeLessThan(0.5);
  });

  it("produces missing-output-mint clarification when no candidate exists", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.89,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      noMintContext,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "missing-output-mint"
    );
  });

  it("produces unknown-output-mint clarification for weak unresolved hints", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.89,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      weakMintContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "unknown-output-mint"
    );
  });

  it("produces ambiguous-output-mint clarification with candidate symbols", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.9,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "ambiguous-output-mint"
    );
    expect(normalized.metadata.clarification?.candidateSymbols).toEqual([
      "BONK",
      "WIF"
    ]);
  });

  it("produces underspecified-request clarification for generic commands", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        confidence: 0.9,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
    expect(normalized.metadata.clarification?.kind).toBe(
      "underspecified-request"
    );
  });
});
