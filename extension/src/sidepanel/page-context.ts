import type { DetectedContextSnapshot, TokenHint } from "../shared/context";

type ChromeTabsApi = {
  query(queryInfo: {
    active?: boolean;
    currentWindow?: boolean;
    lastFocusedWindow?: boolean;
  }): Promise<Array<{ id?: number; url?: string; title?: string }>>;
  sendMessage?<T>(
    tabId: number,
    message: { type: string }
  ): Promise<T>;
};

type ChromeApi = {
  tabs?: ChromeTabsApi;
};

function getChromeApi() {
  return (globalThis as typeof globalThis & {
    chrome?: ChromeApi;
  }).chrome;
}
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
  const chromeApi = getChromeApi();

  if (!chromeApi?.tabs?.query) {
    return null;
  }

  const detectedAt = new Date().toISOString();
  const tabScopes = [
    { active: true, currentWindow: true },
    { currentWindow: true },
    { lastFocusedWindow: true },
    {}
  ] as const;

  let baseContext: DetectedContextSnapshot | null = null;

  for (const scope of tabScopes) {
    const tabs = await chromeApi.tabs.query(scope);
    baseContext = selectCurrentPageContext(tabs, detectedAt);

    if (baseContext) {
      break;
    }
  }

  if (!baseContext?.tabId) {
    return null;
  }

  const pageContext = chromeApi.tabs.sendMessage
    ? await chromeApi.tabs
        .sendMessage<{
          type: "context.detected";
          payload: {
            selectedText?: string;
            rawHints: string[];
            detectedTokens: TokenHint[];
          };
        }>(baseContext.tabId, {
          type: "context.snapshot.requested"
        })
        .catch(() => null)
    : null;

  return {
    ...baseContext,
    selectedText: pageContext?.payload.selectedText,
    rawHints: pageContext?.payload.rawHints ?? baseContext.rawHints,
    detectedTokens: pageContext?.payload.detectedTokens ?? baseContext.detectedTokens
  };
}
