import { describe, expect, it, vi } from "vitest";
import {
  extractDetectedTokens,
  extractRawHints,
  getCurrentPageContext,
  selectCurrentPageContext
} from "../../src/sidepanel/page-context";

describe("page context selection", () => {
  it("returns the first normal webpage in the current window", () => {
    const context = selectCurrentPageContext([
      {
        id: 1,
        url: "chrome-extension://abc/sidepanel.html",
        title: "SIP"
      },
      {
        id: 2,
        url: "https://x.com/some-post",
        title: "A post on X"
      }
    ], "NOW");

    expect(context).toEqual({
      tabId: 2,
      url: "https://x.com/some-post",
      title: "A post on X",
      selectedText: undefined,
      detectedTokens: [],
      rawHints: [],
      detectedAt: "NOW"
    });
  });

  it("extracts lightweight raw hints from page text", () => {
    expect(
      extractRawHints(
        "Buy BONK now on Jupiter. Contract address: AbCdEfGh1234567890"
      )
    ).toEqual(["buy", "bonk", "jupiter", "contract", "abcdefgh1234567890"]);
  });

  it("extracts token hints for x.com cashtags", () => {
    expect(
      extractDetectedTokens(
        "https://x.com/some-post",
        "A post about $BONK and $WIF"
      )
    ).toEqual([
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
    ]);
  });

  it("extracts a high-confidence mint hint from Dexscreener pages", () => {
    expect(
      extractDetectedTokens(
        "https://dexscreener.com/solana/9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s",
        "BONK / SOL pair"
      )
    ).toEqual([
      {
        mint: "9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s",
        source: "dexscreener",
        confidence: 0.92
      },
      {
        symbol: "BONK",
        source: "dexscreener",
        confidence: 0.72
      },
      {
        symbol: "SOL",
        source: "dexscreener",
        confidence: 0.72
      }
    ]);
  });

  it("returns null when no normal webpage is available", () => {
    expect(
      selectCurrentPageContext(
        [
          {
            id: 1,
            url: "chrome://extensions",
            title: "Extensions"
          }
        ],
        "NOW"
      )
    ).toBeNull();
  });

  it("keeps searching tab scopes until it finds a normal page", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 7,
          url: "https://x.com/some-post",
          title: "X post"
        }
      ]);

    const originalChrome = (globalThis as typeof globalThis & {
      chrome?: unknown;
    }).chrome;

    (globalThis as typeof globalThis & {
      chrome?: {
        tabs?: { query: typeof query };
      };
    }).chrome = {
      tabs: {
        query
      }
    };

    const context = await getCurrentPageContext();

    (globalThis as typeof globalThis & {
      chrome?: unknown;
    }).chrome = originalChrome;

    expect(context?.tabId).toBe(7);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("falls back to the tab context when the content bridge is unavailable", async () => {
    const query = vi.fn().mockResolvedValue([
      {
        id: 11,
        url: "https://x.com/some-post",
        title: "X post"
      }
    ]);
    const sendMessage = vi.fn().mockRejectedValue(new Error("no receiver"));

    const originalChrome = (globalThis as typeof globalThis & {
      chrome?: unknown;
    }).chrome;

    (globalThis as typeof globalThis & {
      chrome?: {
        tabs?: { query: typeof query; sendMessage: typeof sendMessage };
      };
    }).chrome = {
      tabs: {
        query,
        sendMessage
      }
    };

    const context = await getCurrentPageContext();

    (globalThis as typeof globalThis & {
      chrome?: unknown;
    }).chrome = originalChrome;

    expect(context).toEqual({
      tabId: 11,
      url: "https://x.com/some-post",
      title: "X post",
      selectedText: undefined,
      detectedTokens: [],
      rawHints: [],
      detectedAt: expect.any(String)
    });
    expect(sendMessage).toHaveBeenCalledWith(11, {
      type: "context.snapshot.requested"
    });
  });
});
