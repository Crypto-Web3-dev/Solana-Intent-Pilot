import { describe, expect, it } from "vitest";
import {
  findSignableTab
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
});
