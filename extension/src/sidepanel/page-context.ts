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

// 核心优化：缩短等待内容脚本的时间，防止按钮卡顿感
const CONTENT_CONTEXT_TIMEOUT_MS = 600;

function getChromeApi() {
  return (globalThis as typeof globalThis & {
    chrome?: ChromeApi;
  }).chrome;
}

function isNormalPage(url?: string) {
  return Boolean(url && (url.startsWith("http://") || url.startsWith("https://")));  
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
    { lastFocusedWindow: true }
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

  // 核心优化：统一条用消息名，确信与内容脚本匹配
  const response = chromeApi.tabs.sendMessage
    ? await withTimeout(
        chromeApi.tabs.sendMessage<{
          payload: {
            selectedText?: string;
            rawHints: string[];
            detectedTokens: TokenHint[];
          };
        }>(baseContext.tabId, {
          type: "context.request_scan" // 与内容脚本保持一致
        }),
        CONTENT_CONTEXT_TIMEOUT_MS
      ).catch(() => null)
    : null;

  return {
    ...baseContext,
    selectedText: response?.payload?.selectedText,
    rawHints: response?.payload?.rawHints ?? baseContext.rawHints,
    detectedTokens: response?.payload?.detectedTokens ?? baseContext.detectedTokens
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {        
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Content context request timed out"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}
