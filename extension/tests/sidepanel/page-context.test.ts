import { describe, expect, it, vi } from "vitest";
import { getCurrentPageContext, selectCurrentPageContext } from "../../src/sidepanel/page-context";
import { isSupportedPageUrl, SUPPORTED_PAGE_MATCHES } from "../../src/shared/supported-pages";
import extensionPackage from "../../package.json";

describe("page context selection", () => {
  it("returns the first supported page in the current window", () => {
    const context = selectCurrentPageContext(
      [
        {
          id: 1,
          url: "chrome-extension://abc/sidepanel.html",
          title: "SIP"
        },
        {
          id: 2,
          url: "https://example.com",
          title: "Example"
        },
        {
          id: 3,
          url: "https://x.com/some-post",
          title: "A post on X"
        }
      ],
      "NOW"
    );

    expect(context).toEqual({
      tabId: 3,
      url: "https://x.com/some-post",
      title: "A post on X",
      selectedText: undefined,
      detectedTokens: [],
      rawHints: [],
      detectedAt: "NOW"
    });
  });

  it("returns null when no supported page is available", () => {
    expect(
      selectCurrentPageContext(
        [
          {
            id: 1,
            url: "chrome://extensions",
            title: "Extensions"
          },
          {
            id: 2,
            url: "https://example.com",
            title: "Example"
          }
        ],
        "NOW"
      )
    ).toBeNull();
  });

  it("keeps searching tab scopes until it finds a supported page", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 2, url: "https://example.com", title: "Example" }])
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
      type: "context.request_scan"
    });
  });

  it("matches bare supported hosts like the manifest does", () => {
    expect(isSupportedPageUrl("https://x.com")).toBe(true);
    expect(isSupportedPageUrl("https://jup.ag")).toBe(true);
    expect(isSupportedPageUrl("https://example.com")).toBe(false);
  });

  it("keeps manifest host permissions aligned with the shared allowlist", () => {
    expect(extensionPackage.manifest.host_permissions).toEqual([...SUPPORTED_PAGE_MATCHES]);
  });
});
