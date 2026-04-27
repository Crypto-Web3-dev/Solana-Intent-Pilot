import { afterEach, describe, expect, it, vi } from "vitest";
import {
  captureContext,
  createContextDetectedMessage
} from "../../src/content/detect-context";

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function installPage(options: {
  href?: string;
  title?: string;
  bodyText?: string;
  selectedText?: string;
  metaDescription?: string;
  links?: string[];
}) {
  const links = (options.links ?? []).map((href) => ({
    getAttribute: (name: string) => (name === "href" ? href : null)
  }));
  const querySelector = vi.fn((selector: string) => {
    if (selector === 'meta[name="description"]' && options.metaDescription) {
      return { getAttribute: () => options.metaDescription };
    }

    return null;
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { href: options.href ?? "https://x.com/some-post" },
      getSelection: () => ({ toString: () => options.selectedText ?? "" })
    }
  });

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      title: options.title ?? "Token post",
      body: { innerText: options.bodyText ?? "" },
      querySelector,
      querySelectorAll: vi.fn((selector: string) => selector === "a[href]" ? links : [])
    }
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: originalDocument
  });
  vi.restoreAllMocks();
});

describe("detect context", () => {
  it("captures token hints as runtime TokenHint objects", () => {
    installPage({
      bodyText: "Thread about $BONK and $WIF",
      selectedText: "buy $BONK",
      metaDescription: "BONK on Solana"
    });

    const context = captureContext();

    expect(context.detectedTokens).toContainEqual({
      symbol: "BONK",
      source: "twitter",
      confidence: 0.82
    });
    expect(context.detectedTokens).toContainEqual({
      symbol: "WIF",
      source: "twitter",
      confidence: 0.82
    });
    expect(context.rawHints).toEqual(["Desc: BONK on Solana"]);
    expect(context.detectedAt).toBeTypeOf("string");
  });

  it("wraps the captured context in the sidepanel response message", () => {
    installPage({
      bodyText: "Dex page for $JUP",
      href: "https://dexscreener.com/solana/9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s"
    });

    const message = createContextDetectedMessage();

    expect(message.type).toBe("context.detected");
    expect(message.payload.detectedTokens.some((token) => token.symbol === "JUP")).toBe(true);
  });

  it("captures Solscan symbols and token links without cashtags", () => {
    installPage({
      href: "https://solscan.io/",
      bodyText: "Popular tokens USDC USDT PUMP D27DgiipBR5dRdij2L6NQ27xwyiLK5Q2DsEM5ML5EuLK",
      links: [
        "/token/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "/token/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "/account/D27DgiipBR5dRdij2L6NQ27xwyiLK5Q2DsEM5ML5EuLK"
      ]
    });

    const context = captureContext();

    expect(context.detectedTokens).toContainEqual({
      symbol: "USDC",
      source: "generic",
      confidence: 0.76
    });
    expect(context.detectedTokens).toContainEqual({
      symbol: "USDT",
      source: "generic",
      confidence: 0.76
    });
    expect(context.detectedTokens).toContainEqual({
      symbol: "PUMP",
      source: "generic",
      confidence: 0.76
    });
    expect(context.detectedTokens).toContainEqual({
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      source: "generic",
      confidence: 0.74
    });
    expect(
      context.detectedTokens.some(
        (token) => token.mint === "D27DgiipBR5dRdij2L6NQ27xwyiLK5Q2DsEM5ML5EuLK"
      )
    ).toBe(true);
  });
});
