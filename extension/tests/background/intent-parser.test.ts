import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/background/openai-intent-parser", () => ({
  createOpenAIIntentParser: vi.fn(() => ({
    parseIntent: vi.fn().mockRejectedValue(new Error("llm unavailable"))
  }))
}));

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
});
