import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectWalletStatus,
  findSignableTab
} from "../../src/sidepanel/wallet-bridge";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("wallet bridge tab selection", () => {
  it("prefers the first normal web page tab", () => {
    const tab = findSignableTab([
      { id: 1, url: "chrome-extension://abc/index.html" },
      { id: 2, url: "https://example.com" },
      { id: 3, url: "https://x.com" }
    ]);

    expect(tab?.id).toBe(2);
  });

  it("prefers a matching normal tab when one is explicitly selected", () => {
    const tab = findSignableTab(
      [
        { id: 1, url: "chrome-extension://abc/index.html" },
        { id: 2, url: "https://example.com" },
        { id: 3, url: "https://x.com" }
      ],
      3
    );

    expect(tab?.id).toBe(3);
  });

  it("falls back to another normal tab when the preferred tab is not signable", () => {
    const tab = findSignableTab(
      [
        { id: 1, url: "chrome-extension://abc/index.html" },
        { id: 2, url: "https://example.com" },
        { id: 3, url: "chrome://extensions" }
      ],
      3
    );

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

  it("connects the page wallet to resolve the taker address when publicKey is not exposed yet", async () => {
    const publicKey = "FTp1BybZ51NiZKbnZH6MsrV3tUZNauhpQMbBcqYUEr5f";
    const connect = vi.fn().mockResolvedValue({
      publicKey: { toBase58: () => publicKey }
    });

    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, url: "https://jup.ag" }])
      },
      scripting: {
        executeScript: vi.fn(async ({ func }: { func: () => Promise<unknown> }) => {
          vi.stubGlobal("window", {
            solana: {
              isConnected: false,
              publicKey: null,
              connect
            }
          });

          return [{ result: await func() }];
        })
      }
    });

    const status = await detectWalletStatus(1);

    expect(connect).toHaveBeenCalledTimes(1);
    expect(status).toEqual({ status: "ready", address: publicKey });
  });

  it("does not report ready when the page wallet has no public key after detection", async () => {
    vi.stubGlobal("chrome", {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 1, url: "https://jup.ag" }])
      },
      scripting: {
        executeScript: vi.fn(async ({ func }: { func: () => Promise<unknown> }) => {
          vi.stubGlobal("window", {
            solana: {
              isConnected: false,
              publicKey: null,
              connect: vi.fn().mockRejectedValue(new Error("User rejected"))
            }
          });

          return [{ result: await func() }];
        })
      }
    });

    const status = await detectWalletStatus(1);

    expect(status.status).not.toBe("ready");
    expect(status.address).toBeUndefined();
  });
});
