import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/background/openai-intent-parser", () => ({
  createOpenAIIntentParser: vi.fn(() => ({
    parseIntent: vi.fn().mockRejectedValue(new Error("llm unavailable"))
  }))
}));

vi.mock("../../src/background/token-context-enricher", () => ({
  enrichDetectedContext: vi.fn(async (context) => ({
    ...context,
    detectedTokens: context.detectedTokens.map((token: any) =>
      token.mint === "9Wvw5mk9wJB22a7KBdFQydpZd3cMa6BZ1pga2PyGpump"
        ? {
            ...token,
            symbol: "FUCK",
            name: "FUCK",
            decimals: 6,
            verified: true,
            verificationSource: "jupiter"
          }
        : token
    )
  }))
}));

import { createOpenAIIntentParser } from "../../src/background/openai-intent-parser";
import { enrichDetectedContext } from "../../src/background/token-context-enricher";

import {
  createDefaultIntentParser,
  createMockIntentParser
} from "../../src/background/intent-parser";

describe("intent parser", () => {
  it("throws when the default production parser cannot parse intent", async () => {
    const parser = createDefaultIntentParser();

    await expect(parser.parseIntent("buy 1 SOL of this")).rejects.toThrow(
      "llm unavailable"
    );
  });

  it("keeps the explicit mock parser available for test and dev-only flows", async () => {
    const parser = createMockIntentParser();
    const intent = await parser.parseIntent("buy 1 SOL of this");

    expect(intent.intentId).toBe("mock-intent-id");
  });

  it("enriches page token candidates before production parsing so decimals are available", async () => {
    const parseIntent = vi.fn().mockResolvedValue({
      intentId: "intent-1",
      mode: "SINGLE",
      actions: [],
      metadata: {
        strategyGoal: "Confirm token",
        reasoning: "Confirm token",
        jitoTipLamports: 0,
        requiresRiskScan: false,
        sourceContext: [],
        needsClarification: true
      }
    });
    vi.mocked(createOpenAIIntentParser).mockReturnValueOnce({
      parseIntent
    } as any);

    const parser = createDefaultIntentParser({ jupiterApiKey: "jup-test-key" });
    const context = {
      tabId: 1,
      url: "https://pump.fun/coin/9Wvw5mk9wJB22a7KBdFQydpZd3cMa6BZ1pga2PyGpump",
      title: "FUCK",
      selectedText: "FUCK",
      detectedAt: "2026-04-27T00:00:00.000Z",
      rawHints: [],
      detectedTokens: [
        {
          mint: "9Wvw5mk9wJB22a7KBdFQydpZd3cMa6BZ1pga2PyGpump",
          source: "generic" as const,
          confidence: 0.96
        }
      ]
    };

    await parser.parseIntent("buy 1 SOL of this", context, "wallet-address");

    expect(enrichDetectedContext).toHaveBeenCalledWith(context, {
      jupiterApiKey: "jup-test-key"
    });
    expect(parseIntent).toHaveBeenCalledWith(
      "buy 1 SOL of this",
      expect.objectContaining({
        detectedTokens: [
          expect.objectContaining({
            mint: "9Wvw5mk9wJB22a7KBdFQydpZd3cMa6BZ1pga2PyGpump",
            symbol: "FUCK",
            decimals: 6,
            verified: true,
            verificationSource: "jupiter"
          })
        ]
      }),
      "wallet-address"
    );
  });
});
