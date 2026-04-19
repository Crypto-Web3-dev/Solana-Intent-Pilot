import type { DetectedContextSnapshot, TokenHint } from "../shared/context";

type ChromeTabsApi = {
  query(queryInfo: {
    currentWindow?: boolean;
  }): Promise<Array<{ id?: number; url?: string; title?: string }>>;
};

type ChromeScriptingApi = {
  executeScript<T>(options: {
    target: { tabId: number; allFrames?: boolean };
    world?: "MAIN" | "ISOLATED";
    args?: unknown[];
    func: (...args: unknown[]) => Promise<T> | T;
  }): Promise<Array<{ result?: T }>>;
};

type ChromeApi = {
  tabs?: ChromeTabsApi;
  scripting?: ChromeScriptingApi;
};

const chromeApi = (globalThis as typeof globalThis & {
  chrome?: ChromeApi;
}).chrome;
const HINT_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "now",
  "this",
  "that",
  "from",
  "your",
  "page",
  "address",
  "token"
]);

function isNormalPage(url?: string) {
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));
}

function detectSource(url: string): TokenHint["source"] {
  if (url.includes("x.com") || url.includes("twitter.com")) {
    return "twitter";
  }

  if (url.includes("dexscreener.com")) {
    return "dexscreener";
  }

  if (url.includes("birdeye.so")) {
    return "birdeye";
  }

  return "generic";
}

function uniqueTokenHints(hints: TokenHint[]) {
  const seen = new Set<string>();

  return hints.filter((hint) => {
    const key = `${hint.source}:${hint.symbol ?? ""}:${hint.mint ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function extractRawHints(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((token) => !HINT_STOP_WORDS.has(token))
        .slice(0, 5) ?? []
    )
  );
}

export function extractDetectedTokens(url: string, text: string) {
  const source = detectSource(url);
  const hints: TokenHint[] = [];
  const cashtags = Array.from(
    new Set(Array.from(text.matchAll(/\$([A-Z0-9]{2,10})/g), (match) => match[1]))
  );
  const upperSymbols = Array.from(
    new Set(
      (text.match(/\b[A-Z]{2,10}\b/g) ?? []).filter((token) => token !== "USD")
    )
  );
  const mintMatch =
    url.match(/\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/) ??
    text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);

  if (mintMatch?.[1] && source !== "twitter") {
    hints.push({
      mint: mintMatch[1],
      source,
      confidence: 0.92
    });
  }

  for (const symbol of cashtags) {
    hints.push({
      symbol,
      source,
      confidence: source === "twitter" ? 0.82 : 0.76
    });
  }

  for (const symbol of upperSymbols.slice(0, 3)) {
    hints.push({
      symbol,
      source,
      confidence: source === "generic" ? 0.58 : 0.72
    });
  }

  return uniqueTokenHints(hints).slice(0, 3);
}

export function selectCurrentPageContext(
  tabs: Array<{ id?: number; url?: string; title?: string }>,
  detectedAt: string
): DetectedContextSnapshot | null {
  const tab = tabs.find((candidate) => isNormalPage(candidate.url));

  if (!tab?.id || !tab.url) {
    return null;
  }

  return {
    tabId: tab.id,
    url: tab.url,
    title: tab.title ?? "Unknown Page",
    selectedText: undefined,
    detectedTokens: [],
    rawHints: [],
    detectedAt
  };
}

export async function getCurrentPageContext() {
  if (!chromeApi?.tabs?.query) {
    return null;
  }

  const tabs = await chromeApi.tabs.query({
    currentWindow: true
  });
  const detectedAt = new Date().toISOString();
  const baseContext = selectCurrentPageContext(tabs, detectedAt);

  if (!baseContext?.tabId) {
    return null;
  }

  if (!chromeApi?.scripting?.executeScript) {
    return baseContext;
  }

  const pageResults = await chromeApi.scripting.executeScript<{
    selectedText?: string;
    rawHints: string[];
    detectedTokens: TokenHint[];
  }>({
    target: { tabId: baseContext.tabId },
    world: "MAIN",
    func: () => {
      type PageTokenSource = "twitter" | "birdeye" | "dexscreener" | "generic";
      type PageTokenHint = {
        symbol?: string;
        mint?: string;
        source: PageTokenSource;
        confidence: number;
      };
      const hintStopWords = new Set([
        "the",
        "and",
        "for",
        "with",
        "now",
        "this",
        "that",
        "from",
        "your",
        "page",
        "address",
        "token"
      ]);
      const selectedText = window.getSelection?.()?.toString().trim() || undefined;
      const bodyText = document.body?.innerText ?? "";
      const pageText = `${document.title ?? ""}\n${bodyText}`;
      const detectSource = (url: string): PageTokenSource => {
        if (url.includes("x.com") || url.includes("twitter.com")) {
          return "twitter";
        }

        if (url.includes("dexscreener.com")) {
          return "dexscreener";
        }

        if (url.includes("birdeye.so")) {
          return "birdeye";
        }

        return "generic";
      };
      const source = detectSource(window.location.href);
      const rawHints = Array.from(
        new Set(
          (bodyText.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
            .filter((token) => !hintStopWords.has(token))
            .slice(0, 5)
        )
      );
      const cashtags = Array.from(
        new Set(
          Array.from(pageText.matchAll(/\$([A-Z0-9]{2,10})/g), (match) => match[1])
        )
      );
      const upperSymbols = Array.from(
        new Set(
          (pageText.match(/\b[A-Z]{2,10}\b/g) ?? []).filter(
            (token) => token !== "USD"
          )
        )
      );
      const mintMatch =
        window.location.href.match(/\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})/) ??
        pageText.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
      const hints: PageTokenHint[] = [];

      if (mintMatch?.[1] && source !== "twitter") {
        hints.push({
          mint: mintMatch[1],
          source,
          confidence: 0.92
        });
      }

      for (const symbol of cashtags) {
        hints.push({
          symbol,
          source,
          confidence: source === "twitter" ? 0.82 : 0.76
        });
      }

      for (const symbol of upperSymbols.slice(0, 3)) {
        hints.push({
          symbol,
          source,
          confidence: source === "generic" ? 0.58 : 0.72
        });
      }
      const detectedTokens = hints.filter((hint, index, items) => {
        const key = `${hint.source}:${hint.symbol ?? ""}:${hint.mint ?? ""}`;

        return (
          items.findIndex(
            (candidate) =>
              `${candidate.source}:${candidate.symbol ?? ""}:${candidate.mint ?? ""}` ===
              key
          ) === index
        );
      }).slice(0, 3);

      return {
        selectedText,
        rawHints,
        detectedTokens
      };
    }
  });

  const pageContext = pageResults.at(0)?.result;

  return {
    ...baseContext,
    selectedText: pageContext?.selectedText,
    rawHints: pageContext?.rawHints ?? baseContext.rawHints,
    detectedTokens: pageContext?.detectedTokens ?? baseContext.detectedTokens
  };
}
