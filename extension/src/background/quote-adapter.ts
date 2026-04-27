import type { SIPAction } from "../shared/intent";

export interface QuoteResult {
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
  quoteResponse?: any;
}

export interface QuoteAdapter {
  getOrder(action: SIPAction): Promise<{ quote: any; swapTransaction: string }>;
  executeSwap(requestId: string, signedTransaction: string): Promise<any>;
}

export function createMockQuoteAdapter(): QuoteAdapter {
  return {
    async getOrder(action: SIPAction) {
      void action;
      return {
        quote: { inAmount: "1000000000", outAmount: "100000000", signatureFeeLamports: "5000" },
        swapTransaction: "mock-tx-payload-from-adapter"
      };
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
  const apiKey = options?.apiKey ?? process.env.PLASMO_PUBLIC_JUPITER_API_KEY ?? process.env.JUPITER_API_KEY;
  const fetchImpl = options?.fetchImpl;

  const proxiedFetch = async (url: string, options?: any) => {
    if (fetchImpl || typeof window === 'undefined') {
      const f = fetchImpl || fetch;
      return f(url, {
        ...options,
        headers: apiKey
          ? {
              ...options?.headers,
              "x-api-key": apiKey
            }
          : options?.headers
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
            ...(apiKey ? { "x-api-key": apiKey } : {})
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
    async getOrder(action: SIPAction) {
      if (!action.payload) throw new Error("Action payload missing for quote");
      const swapMode = action.payload.swapMode ?? "ExactIn";

      const url = new URL(`${baseUrl}/order`);
      url.searchParams.append("swapMode", swapMode);
      url.searchParams.append("slippageBps", String(action.payload.slippageBps || 50));
      url.searchParams.append("inputMint", action.payload.inputMint);
      url.searchParams.append("outputMint", action.payload.outputMint);
      url.searchParams.append("amount", action.payload.amount);
      url.searchParams.append("forJitoBundle", "false"); 

      if (action.payload.userPublicKey) {
        url.searchParams.append("taker", action.payload.userPublicKey);
      }

      const response = await proxiedFetch(url.toString(), {
        method: "GET"
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.error || data.errorCode) {
        // 提取具体的错误信息
        const errorMsg = data.errorMessage || data.error || data.message || "Jupiter quote request failed";
        throw new Error(errorMsg);
      }

      if (!data.transaction) {
        throw new Error("Jupiter returned a quote but no transaction payload. (Check liquidity/balance)");
      }

      return {
        quote: data,
        swapTransaction: data.transaction
      };
    },

    async executeSwap(requestId: string, signedTransaction: string) {
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

  return {
    async getOrder(action: SIPAction) {
        // 彻底移除自动 Mock 回退逻辑，确保生产环境下必须返回真实结果或真实报错
        return await liveAdapter.getOrder(action);
    },
    async executeSwap(requestId: string, signed: string) {
        return await liveAdapter.executeSwap(requestId, signed);
    }
  };
}
