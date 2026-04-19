import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { WalletStatus } from "./wallet-state";

export type SubmissionOutcome = "submitted" | "settled" | "failed" | "timeout";

export interface SubmissionLifecycleOptions {
  settlementTimeoutMs: number;
  maxRetries: number;
}

type ChromeScriptingApi = {
  executeScript<T>(options: {
    target: { tabId: number; allFrames?: boolean };
    world?: "MAIN" | "ISOLATED";
    args?: unknown[];
    func: (...args: unknown[]) => Promise<T> | T;
  }): Promise<Array<{ result?: T | { error?: string } }>>;
};

type ChromeTabsApi = {
  query(
    queryInfo: { active?: boolean; currentWindow?: boolean }
  ): Promise<Array<{ id?: number; url?: string; pendingUrl?: string }>>;
};

type ChromeApi = {
  tabs?: ChromeTabsApi;
  scripting?: ChromeScriptingApi;
};

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;

function canInjectIntoUrl(url?: string) {
  if (!url) {
    return false;
  }

  return url.startsWith("http://") || url.startsWith("https://");
}

type BrowserTab = {
  id?: number;
  url?: string;
  pendingUrl?: string;
};

export function findSignableTab(tabs: BrowserTab[]) {
  return tabs.find((tab) => canInjectIntoUrl(tab.url ?? tab.pendingUrl));
}

export function canRetrySubmission(
  reason: string,
  attempt: number,
  maxRetries: number
) {
  const transient =
    reason.includes("transient") ||
    reason.includes("temporarily") ||
    reason.includes("network");

  return transient && attempt < maxRetries;
}

export function hasSubmissionTimedOut(
  startedAt: number,
  now: number,
  timeoutMs: number
) {
  return now - startedAt >= timeoutMs;
}

export async function detectWalletStatus(): Promise<WalletStatus> {
  if (!chromeApi?.tabs?.query || !chromeApi?.scripting?.executeScript) {
    return "failed";
  }

  const tabs = await chromeApi.tabs.query({
    currentWindow: true
  });
  const tab = findSignableTab(tabs);

  if (!tab?.id) {
    return "unsupported-page";
  }

  const results = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: ["", {} as SIPIntent, {} as ExecutionPreview],
    func: () => {
      const solana = (window as typeof window & {
        solana?: unknown;
      }).solana;

      return Boolean(solana);
    }
  });

  return results.at(0)?.result ? "ready" : "provider-missing";
}

export async function submitViaPageBridge(
  requestId: string,
  intent: SIPIntent,
  preview: ExecutionPreview
): Promise<{
  signature: string;
  explorerUrl?: string;
}> {
  if (!chromeApi?.tabs?.query || !chromeApi?.scripting?.executeScript) {
    throw new Error("Chrome scripting API is unavailable");
  }

  const tabs = await chromeApi.tabs.query({
    currentWindow: true
  });

  const tab = findSignableTab(tabs);
  if (!tab?.id) {
    throw new Error(
      "Wallet signing is only available on normal web pages. Please switch to an http(s) tab."
    );
  }

  const tabUrl = tab.url ?? tab.pendingUrl;

  if (!canInjectIntoUrl(tabUrl)) {
    throw new Error(
      "Wallet signing is only available on normal web pages. Please switch to an http(s) page."
    );
  }

  const results = await chromeApi.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    args: [requestId, intent, preview],
    func: async (activeRequestId, activeIntent, activePreview) => {
      void activeIntent;
      void activePreview;

      const solana = (window as typeof window & {
        solana?: {
          connect?: () => Promise<void>;
          signAndSendTransaction?: (
            transaction: unknown
          ) => Promise<{ signature: string }>;
          signTransaction?: (transaction: unknown) => Promise<unknown>;
        };
      }).solana;

      if (!solana) {
        throw new Error("Wallet provider not available in page context");
      }

      if (typeof solana.connect === "function") {
        await solana.connect();
      }

      if (typeof solana.signAndSendTransaction === "function") {
        const signed = await solana.signAndSendTransaction({});

        return {
          signature: signed.signature,
          explorerUrl: `https://explorer.solana.com/tx/${signed.signature}`
        };
      }

      if (typeof solana.signTransaction === "function") {
        await solana.signTransaction({});

        return {
          signature: `signed-${activeRequestId}`,
          explorerUrl: `https://explorer.solana.com/tx/signed-${activeRequestId}`
        };
      }

      throw new Error("No compatible wallet signing method found");
    }
  });

  const result = results.at(0)?.result;

  if (!result || "error" in result) {
    throw new Error(result?.error ?? "Wallet submission failed");
  }

  return result as { signature: string; explorerUrl?: string };
}

export async function submitWithLifecycle(
  requestId: string,
  intent: SIPIntent,
  preview: ExecutionPreview,
  options: SubmissionLifecycleOptions = {
    settlementTimeoutMs: 5_000,
    maxRetries: 1
  }
): Promise<{
  outcome: SubmissionOutcome;
  signature?: string;
  explorerUrl?: string;
}> {
  let attempt = 0;
  let lastError: string | null = null;

  while (attempt <= options.maxRetries) {
    const startedAt = Date.now();

    try {
      const submission = await Promise.race([
        submitViaPageBridge(requestId, intent, preview),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Submission timeout"));
          }, options.settlementTimeoutMs);
        })
      ]);

      return {
        outcome: "settled",
        signature: submission.signature,
        explorerUrl: submission.explorerUrl
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Wallet submission failed";

      if (
        canRetrySubmission(lastError, attempt, options.maxRetries) &&
        !hasSubmissionTimedOut(startedAt, Date.now(), options.settlementTimeoutMs)
      ) {
        attempt += 1;
        continue;
      }

      break;
    }
  }

  if (lastError?.includes("timeout")) {
    return {
      outcome: "timeout"
    };
  }

  return {
    outcome: "failed"
  };
}
