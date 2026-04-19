import { describe, expect, it } from "vitest";
import {
  canRetrySubmission,
  findSignableTab,
  hasSubmissionTimedOut
} from "../../src/sidepanel/wallet-bridge";

describe("wallet bridge tab selection", () => {
  it("prefers the first normal web page tab", () => {
    const tab = findSignableTab([
      { id: 1, url: "chrome-extension://abc/index.html" },
      { id: 2, url: "https://example.com" },
      { id: 3, url: "https://x.com" }
    ]);

    expect(tab?.id).toBe(2);
  });

  it("skips extension tabs when a normal page exists later in the list", () => {
    const tab = findSignableTab([
      { id: 1, url: "chrome-extension://abc/index.html" },
      { id: 2, url: "http://example.com" }
    ]);

    expect(tab?.id).toBe(2);
  });

  it("falls back to pendingUrl when url is unavailable", () => {
    const tab = findSignableTab([
      { id: 1, pendingUrl: "https://example.com" }
    ]);

    expect(tab?.id).toBe(1);
  });

  it("returns undefined when no normal tab exists", () => {
    expect(
      findSignableTab([{ id: 1, url: "chrome://extensions" }])
    ).toBeUndefined();
  });

  it("allows one retry for transient submission errors", () => {
    expect(canRetrySubmission("transient network error", 0, 1)).toBe(true);
    expect(canRetrySubmission("transient network error", 1, 1)).toBe(false);
  });

  it("treats non-transient submission errors as non-retryable", () => {
    expect(canRetrySubmission("Wallet provider not available", 0, 1)).toBe(
      false
    );
  });

  it("detects when a submission has timed out", () => {
    expect(hasSubmissionTimedOut(1_000, 6_500, 5_000)).toBe(true);
    expect(hasSubmissionTimedOut(1_000, 5_900, 5_000)).toBe(false);
  });
});
