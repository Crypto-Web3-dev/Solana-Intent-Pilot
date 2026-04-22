import type { SIPIntent } from "../shared/intent";

export interface QuoteResult {
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
  quoteResponse?: any;
}

export interface QuoteAdapter {
  getOrder(intent: SIPIntent): Promise<{ quote: any; swapTransaction: string }>;
  executeSwap(requestId: string, signedTransaction: string): Promise<any>;
}

export function createMockQuoteAdapter(): QuoteAdapter {
  return {
    async getOrder(intent: SIPIntent) {
      return { quote: {}, swapTransaction: "mock-tx" };
    },
    async executeSwap() {
      return { txid: "mock-txid" };
    }
  };
}

export function createJupiterQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
}): QuoteAdapter {
  const baseUrl = options?.baseUrl ?? "https://api.jup.ag/swap/v2";
  const apiKey = options?.apiKey ?? "jup_ec3dc20d6743950456d51c8cb599131aac04138e93cab56ac3f605eb024b1ea2";
  const fetchImpl = options?.fetchImpl;

  const proxiedFetch = async (url: string, options?: any) => {
    // Background scripts can fetch directly without CORS issues
    if (fetchImpl || typeof window === 'undefined') {
      const f = fetchImpl || fetch;
      return f(url, {
        ...options,
        headers: {
          ...options?.headers,
          "x-api-key": apiKey
        }
      });
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (!tabId) throw new Error("No active tab");

    const mergedOptions = {
        ...options,
        headers: {
            ...options?.headers,
            "Content-Type": "application/json",
            "x-api-key": apiKey
        }
    };

    const response = await chrome.tabs.sendMessage(tabId, {
      type: "api.request.requested",
      payload: { url, options: mergedOptions }
    });

    if (!response.ok) throw new Error(`API failed with status ${response.status}`);
    return {
      json: async () => response.data,
      ok: true
    } as Response;
  };

  return {
    async getOrder(intent: SIPIntent) {
      const url = new URL(`${baseUrl}/order`);
      url.searchParams.append("swapMode", "ExactIn");
      url.searchParams.append("slippageBps", String(intent.payload.slippageBps || 50));
      url.searchParams.append("inputMint", intent.payload.inputMint);
      url.searchParams.append("outputMint", intent.payload.outputMint);
      url.searchParams.append("amount", intent.payload.amount);
      
      // 恢复动态获取 taker 地址
      if (intent.payload.userPublicKey) {
        url.searchParams.append("taker", intent.payload.userPublicKey);
      }

      const response = await proxiedFetch(url.toString(), {
        method: "GET"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error || data.errorCode) {
        const errorMsg = data.errorMessage || data.error || "Jupiter quote request failed";
        throw new Error(errorMsg);
      }

      // 根据提供的 JSON，交易载荷在 'transaction' 字段中
      return {
        quote: data,
        swapTransaction: data.transaction || null
      };
    },

    async executeSwap(requestId: string, signedTransaction: string) {
      // For V2, execution usually involves sending the signed TX to RPC or a swap endpoint
      const url = new URL(`${baseUrl}/swap`);
      const response = await proxiedFetch(url.toString(), {
        method: "POST",
        body: JSON.stringify({ requestId, signedTransaction })
      });
      return await response.json();
    }
  };
}

export function createDefaultQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  apiKey?: string;
  fallbackAdapter?: QuoteAdapter;
}): QuoteAdapter {
  const liveAdapter = createJupiterQuoteAdapter(options);
  // 不再默认回退到 Mock，除非显式指定，以方便排查真实 API 问题
  const fallbackAdapter = options?.fallbackAdapter;

  return {
    async getOrder(intent: SIPIntent) {
        try {
          return await liveAdapter.getOrder(intent);
        } catch (error) {
          if (fallbackAdapter) {
            return fallbackAdapter.getOrder(intent);
          }
          throw error;
        }
    },
    async executeSwap(requestId: string, signed: string) {
        try { return await liveAdapter.executeSwap(requestId, signed); }
        catch (error) {
          if (fallbackAdapter) {
            return fallbackAdapter.executeSwap(requestId, signed);
          }
          throw error;
        }
    }
  };
}
