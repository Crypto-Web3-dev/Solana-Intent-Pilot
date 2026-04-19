import { describe, expect, it } from "vitest";
import {
  extractDetectedTokens,
  extractRawHints,
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
});
