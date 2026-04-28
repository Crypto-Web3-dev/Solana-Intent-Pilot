import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearTokenContextMetadataCache,
  enrichDetectedContext,
  extractSolscanTokenMetadata,
  verifyJupiterToken,
  verifyJupiterTokenSymbol,
  verifySolscanToken
} from "../../src/background/token-context-enricher";
import type { DetectedContextSnapshot } from "../../src/shared/context";

const pumpMint = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";
const raveMint = "raveUiWMT7ndHqMz9VfhXHzGaqZ4o9Q8VgKzYfY5xQn";
const accountAddress = "D27DgiipBR5dRdij2L6NQ27xwyiLK5Q2DsEM5ML5EuLK";

afterEach(() => {
  clearTokenContextMetadataCache();
  vi.restoreAllMocks();
});

function htmlResponse(html: string, url: string, ok = true): Response {
  return {
    ok,
    url,
    text: async () => html
  } as Response;
}

function jsonResponse(payload: unknown, url: string, ok = true): Response {
  return {
    ok,
    url,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  } as Response;
}

function contextWithTokens(): DetectedContextSnapshot {
  return {
    tabId: 1,
    url: "https://solscan.io/leaderboard/token",
    title: "Solscan Token Leaderboard",
    detectedAt: "2026-04-26T00:00:00.000Z",
    selectedText: undefined,
    rawHints: [],
    detectedTokens: [
      {
        mint: accountAddress,
        source: "generic",
        confidence: 0.74
      },
      {
        mint: pumpMint,
        source: "generic",
        confidence: 0.74
      },
      {
        symbol: "USDC",
        source: "generic",
        confidence: 0.76
      },
      {
        symbol: "RAVE",
        source: "twitter",
        confidence: 0.82
      }
    ]
  };
}

describe("token context enricher", () => {
  it("extracts token symbol and name from a Solscan token page", () => {
    const metadata = extractSolscanTokenMetadata(
      `<html><head><title>Pump.fun (PUMP) Token Tracker | Solscan</title></head><body>${pumpMint}</body></html>`,
      pumpMint
    );

    expect(metadata).toEqual({
      name: "Pump.fun",
      symbol: "PUMP",
      verificationSource: "solscan"
    });
  });

  it("verifies mint metadata through Jupiter token search", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(
        [
          {
            id: pumpMint,
            name: "Pump",
            symbol: "PUMP",
            decimals: 6,
            icon: "https://static.jup.ag/pump/icon.png"
          }
        ],
        String(url)
      )
    );

    await expect(verifyJupiterToken(pumpMint, fetchImpl)).resolves.toEqual({
      mint: pumpMint,
      name: "Pump",
      symbol: "PUMP",
      decimals: 6,
      icon: "https://static.jup.ag/pump/icon.png",
      verificationSource: "jupiter"
    });
  });

  it("binds the default fetch when verifying mint metadata from a worker runtime", async () => {
    const fetchSpy = vi.fn(function (this: unknown, url: RequestInfo | URL) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      return Promise.resolve(
        jsonResponse(
          [
            {
              id: pumpMint,
              name: "Pump",
              symbol: "PUMP",
              decimals: 6
            }
          ],
          String(url)
        )
      );
    });
    vi.stubGlobal("fetch", fetchSpy);

    await expect(verifyJupiterToken(pumpMint)).resolves.toMatchObject({
      mint: pumpMint,
      symbol: "PUMP",
      decimals: 6
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("verifies a symbol-only candidate through a unique Jupiter exact match", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(
        [
          {
            id: raveMint,
            name: "Rave",
            symbol: "RAVE",
            decimals: 6
          }
        ],
        String(url)
      )
    );

    await expect(verifyJupiterTokenSymbol("RAVE", fetchImpl)).resolves.toEqual({
      mint: raveMint,
      name: "Rave",
      symbol: "RAVE",
      decimals: 6,
      icon: undefined,
      verificationSource: "jupiter"
    });
  });

  it("rejects ambiguous symbol-only Jupiter matches", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(
        [
          { id: raveMint, name: "Rave", symbol: "RAVE", decimals: 6 },
          {
            id: "9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s",
            name: "Rave Clone",
            symbol: "RAVE",
            decimals: 9
          }
        ],
        String(url)
      )
    );

    await expect(verifyJupiterTokenSymbol("RAVE", fetchImpl)).resolves.toBeNull();
  });

  it("rejects short symbols like AI for automatic Jupiter verification", async () => {
    const fetchImpl = vi.fn();

    await expect(verifyJupiterTokenSymbol("AI", fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("filters unverified account-like addresses before AI parsing", async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.includes("api.jup.ag") && href.includes(pumpMint)) {
        return jsonResponse(
          [
            {
              id: pumpMint,
              name: "Pump",
              symbol: "PUMP",
              decimals: 6
            }
          ],
          href
        );
      }

      if (href.includes("api.jup.ag") && href.includes("RAVE")) {
        return jsonResponse(
          [
            {
              id: raveMint,
              name: "Rave",
              symbol: "RAVE",
              decimals: 6
            }
          ],
          href
        );
      }

      return jsonResponse([], href);
    });

    const enriched = await enrichDetectedContext(contextWithTokens(), { fetchImpl });

    expect(enriched.detectedTokens).toContainEqual({
      mint: pumpMint,
      name: "Pump",
      symbol: "PUMP",
      decimals: 6,
      source: "generic",
      confidence: 0.92,
      verified: true,
      verificationSource: "jupiter"
    });
    expect(enriched.detectedTokens.some((token) => token.mint === accountAddress)).toBe(false);
    expect(enriched.detectedTokens.some((token) => token.symbol === "USDC")).toBe(true);
    expect(enriched.detectedTokens).toContainEqual({
      mint: raveMint,
      name: "Rave",
      symbol: "RAVE",
      source: "twitter",
      confidence: 0.9,
      decimals: 6,
      verified: true,
      verificationSource: "jupiter"
    });
  });

  it("rejects Solscan responses that redirect away from the token page", async () => {
    const fetchImpl = vi.fn(async () =>
      htmlResponse("<html><title>Account | Solscan</title></html>", `https://solscan.io/account/${accountAddress}`)
    );

    await expect(verifySolscanToken(accountAddress, fetchImpl)).resolves.toBeNull();
  });

  it("reuses mint metadata for matching symbol hints and repeated enrichment", async () => {
    const fuckMint = "9Wvw5mk9wJB22a7KBdFQydpZd3cMa6BZ1pga2PyGpump";
    const context: DetectedContextSnapshot = {
      tabId: 1,
      url: `https://pump.fun/coin/${fuckMint}`,
      title: "FUCK",
      detectedAt: "2026-04-27T00:00:00.000Z",
      selectedText: "FUCK",
      rawHints: [],
      detectedTokens: [
        {
          mint: fuckMint,
          source: "generic",
          confidence: 0.96
        },
        {
          symbol: "FUCK",
          source: "generic",
          confidence: 0.9
        }
      ]
    };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      return jsonResponse(
        [
          {
            id: fuckMint,
            name: "FUCK",
            symbol: "FUCK",
            decimals: 6
          }
        ],
        href
      );
    });

    const first = await enrichDetectedContext(context, { fetchImpl });
    const second = await enrichDetectedContext(context, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`query=${fuckMint}`);
    expect(first.detectedTokens).toContainEqual({
      mint: fuckMint,
      name: "FUCK",
      symbol: "FUCK",
      decimals: 6,
      source: "generic",
      confidence: 0.96,
      verified: true,
      verificationSource: "jupiter"
    });
    expect(second.detectedTokens).toContainEqual(
      expect.objectContaining({
        mint: fuckMint,
        symbol: "FUCK",
        decimals: 6,
        verified: true
      })
    );
  });
});
