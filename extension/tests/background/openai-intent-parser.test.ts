import { describe, expect, it, vi } from "vitest";
import {
  createOpenAIIntentParser,
  formatContextForPrompt,
  normalizeIntentWithContext
} from "../../src/background/openai-intent-parser";
import type { SIPIntent } from "../../src/shared/intent";
import type { DetectedContextSnapshot } from "../../src/shared/context";

const validIntent: SIPIntent = {
  intentId: "req-1",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6fP4H4oL8nHeLqPm",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      },
      status: "pending"
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap SOL into BONK using page context.",
    estimatedNetChange: {},
    jitoTipLamports: 0,
    reasoning: "Swap SOL into BONK using page context.",
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

    expect(result.actions[0].type).toBe("SWAP");
  });

  it("formats context into a stable summary block", () => {
    const summary = formatContextForPrompt(contextSnapshot);

    expect(summary).toContain("Page URL:");
    expect(summary).toContain("Selected Text:");
    expect(summary).toContain("Detected Tokens:");
  });

  it("keeps high certainty for a specific request with strong context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.metadata.needsClarification).toBe(false);
    expect(normalized.metadata.sourceContext).toContain("user-input");
    expect(normalized.metadata.sourceContext).toContain("detected-token");
  });

  it("requires clarification when multiple token candidates exist", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      multiTokenContext,
      "buy this"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
  });

  it("requires clarification for extremely underspecified requests", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy"
    );

    expect(normalized.metadata.needsClarification).toBe(true);
  });

  it("keeps a resolved outputMint when explicit intent matches strong single-token context", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
        metadata: {
          ...validIntent.metadata,
          sourceContext: []
        }
      },
      contextSnapshot,
      "buy 1 SOL of BONK"
    );

    expect(normalized.actions[0].payload.outputMint).toBe(validIntent.actions[0].payload.outputMint);
    expect(normalized.metadata.needsClarification).toBe(false);
  });

  it("produces missing-output-mint clarification when no candidate exists", () => {
    const normalized = normalizeIntentWithContext(
      {
        ...validIntent,
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
