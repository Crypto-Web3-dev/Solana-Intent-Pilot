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

function getChromeApi() {
  return (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;
}

function canInjectIntoUrl(url?: string) {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

type BrowserTab = {
  id?: number;
  url?: string;
  pendingUrl?: string;
};

export function findSignableTab(tabs: BrowserTab[], preferredTabId?: number) {
  const preferredTab = preferredTabId ? tabs.find((tab) => tab.id === preferredTabId) : undefined;
  if (preferredTab && canInjectIntoUrl(preferredTab.url ?? preferredTab.pendingUrl)) {
    return preferredTab;
  }
  return tabs.find((tab) => canInjectIntoUrl(tab.url ?? tab.pendingUrl));
}

export async function detectWalletStatus(
  preferredTabId?: number
): Promise<{ status: WalletStatus; address?: string }> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query || !chromeApi?.scripting?.executeScript) {
    return { status: "unknown" };
  }

  const tabs = await chromeApi.tabs.query({ currentWindow: true });
  const tab = findSignableTab(tabs, preferredTabId);
  if (!tab?.id) return { status: "unsupported-page" };

  try {
    const results = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [],
      func: async () => {
        const solana = (window as any).solana;
        if (!solana) return null;
        let publicKey = solana.publicKey?.toBase58() || null;

        if (!publicKey && solana.connect) {
          try {
            const connected = await solana.connect();
            publicKey =
              connected?.publicKey?.toBase58?.() ||
              solana.publicKey?.toBase58?.() ||
              null;
          } catch {
            return {
              isConnected: false,
              publicKey: null,
              providerAvailable: true
            };
          }
        }

        return {
          isConnected: solana.isConnected || false,
          publicKey,
          providerAvailable: true
        };
      }
    });

    const result = results.at(0)?.result as any;
    if (!result) return { status: "provider-missing" };
    if (!result.publicKey) return { status: "provider-missing" };

    return {
      status: "ready",
      address: result.publicKey
    };
  } catch {
    return { status: "unknown" };
  }
}

export async function submitViaPageBridge(
  requestId: string,
  intent: SIPIntent,
  preview: ExecutionPreview,
  preferredTabId?: number
): Promise<{ signature: string; explorerUrl?: string }> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query || !chromeApi?.scripting) {
    throw new Error("Chrome API is unavailable");
  }

  const tabs = await chromeApi.tabs.query({ currentWindow: true, active: true });
  const tab = findSignableTab(tabs, preferredTabId);
  if (!tab?.id) throw new Error("Wallet signing is only available on normal web pages.");

  console.log("[SIP Bridge] Directly calling wallet via executeScript...");

  // CRITICAL FIX: Ensure the argument is a clean, serializable string.
  // preview might be a Proxy or have unserializable properties in some environments.
  const txBase64 = String(preview.swapTransaction || "");
  if (!txBase64) {
      throw new Error("Transaction payload is empty or invalid.");
  }

  try {
    const results = await chromeApi.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      args: [txBase64],
      func: async (base64Transaction: string) => {
        console.log("[SIP] Injected script started");
        const solana = (window as any).solana;
        const solanaWeb3 = (window as any).solanaWeb3;

        if (!solana) return { error: "Wallet not found. Please open Phantom." };
        
        try {
          if (solana.connect) await solana.connect();

          const actualTaker = solana.publicKey?.toBase58();
          console.log("[SIP] Wallet connected:", actualTaker);

          // Decode Base64
          const binaryString = atob(base64Transaction);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          let txToSign: any;

          // Versioned Transaction Support
          if (solanaWeb3 && solanaWeb3.VersionedTransaction) {
            console.log("[SIP] Deserializing Versioned Transaction...");
            txToSign = solanaWeb3.VersionedTransaction.deserialize(bytes);
          } else {
            console.warn("[SIP] solanaWeb3 not found. Using shim...");
            txToSign = {
              serialize: () => bytes,
              message: {
                staticAccountKeys: [],
                compiledInstructions: [],
                header: {
                  numRequiredSignatures: 0,
                  numReadonlySignedAccounts: 0,
                  numReadonlyUnsignedAccounts: 0
                }
              },
              signatures: []
            };
          }

          console.log("[SIP] Requesting signature...");
          const result = await solana.signAndSendTransaction(txToSign); 
          return { signature: result.signature };
        } catch (e: any) {
          console.error("[SIP] Injected error:", e);
          return { error: e.message || String(e) };
        }
      }
    });

    const result = (results.at(0)?.result || {}) as any;

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.signature) {
      throw new Error("No signature returned from injected script.");
    }

    return {
      signature: result.signature,
      explorerUrl: `https://explorer.solana.com/tx/${result.signature}`
    };
  } catch (err: any) {
    console.error("[SIP Bridge] Final Error:", err.message);
    throw err;
  }
}

export async function submitWithLifecycle(
  requestId: string,
  intent: SIPIntent,
  preview: ExecutionPreview,
  preferredTabId?: number,
  options: SubmissionLifecycleOptions = {
    settlementTimeoutMs: 60_000,
    maxRetries: 0
  }
): Promise<{ outcome: SubmissionOutcome; signature?: string; explorerUrl?: string; error?: string }> {
  try {
    const submission = await Promise.race([
      submitViaPageBridge(requestId, intent, preview, preferredTabId),
      new Promise<never>((_, reject) => {
        setTimeout(() => { reject(new Error("Timeout: User did not sign the transaction in time.")); }, options.settlementTimeoutMs);        
      })
    ]);

    return {
      outcome: "settled",
      signature: submission.signature,
      explorerUrl: submission.explorerUrl
    };
  } catch (error: any) {
    return {
      outcome: error.message.includes("Timeout") ? "timeout" : "failed",
      error: error.message || "Unknown submission error"
    };
  }
}
