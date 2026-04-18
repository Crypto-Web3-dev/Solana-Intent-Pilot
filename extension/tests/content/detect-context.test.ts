import { describe, expect, it } from "vitest";
import {
  buildMockDetectedContext,
  createContextDetectedMessage
} from "../../src/content/detect-context";

describe("detect context", () => {
  it("builds a serializable mock context payload", () => {
    const context = buildMockDetectedContext();

    expect(context.url).toBeTypeOf("string");
    expect(context.title).toBeTypeOf("string");
    expect(Array.isArray(context.detectedTokens)).toBe(true);
    expect(Array.isArray(context.rawHints)).toBe(true);
  });

  it("wraps the mock context in a context.detected message", () => {
    const message = createContextDetectedMessage();

    expect(message.type).toBe("context.detected");
    expect(message.payload.detectedAt).toBeTypeOf("string");
  });
});
