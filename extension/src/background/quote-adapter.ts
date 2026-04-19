import type { SIPIntent } from "../shared/intent";

export interface QuoteResult {
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
}

export interface QuoteAdapter {
  getQuote(intent: SIPIntent): Promise<QuoteResult>;
}

type JupiterQuoteResponse = {
  inAmount?: string;
  outAmount?: string;
};

function isUsableQuoteResponse(
  response: JupiterQuoteResponse
): response is Required<JupiterQuoteResponse> {
  return Boolean(response.inAmount && response.outAmount);
}

export function createMockQuoteAdapter(): QuoteAdapter {
  return {
    async getQuote(intent: SIPIntent): Promise<QuoteResult> {
      if (intent.payload.outputMint.includes("quote-fail")) {
        throw new Error("Quote generation failed");
      }

      return {
        routeLabel: "Jupiter",
        inputAmount: "1 SOL",
        outputAmount: "100 USDC",
        slippageBps: intent.payload.slippageBps,
        estimatedFeeLamports: "5000"
      };
    }
  };
}

export function createJupiterQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}): QuoteAdapter {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const baseUrl = options?.baseUrl ?? "https://lite-api.jup.ag";

  return {
    async getQuote(intent: SIPIntent): Promise<QuoteResult> {
      if (!fetchImpl) {
        throw new Error("Fetch is unavailable");
      }

      const url = new URL("/swap/v1/quote", baseUrl);
      url.searchParams.set("inputMint", intent.payload.inputMint);
      url.searchParams.set("outputMint", intent.payload.outputMint);
      url.searchParams.set("amount", intent.payload.amount);
      url.searchParams.set("slippageBps", String(intent.payload.slippageBps));

      const response = await fetchImpl(url.toString());

      if (!response.ok) {
        throw new Error(`Jupiter quote failed with status ${response.status}`);
      }

      const payload = (await response.json()) as JupiterQuoteResponse;

      if (!isUsableQuoteResponse(payload)) {
        throw new Error("Jupiter quote response is missing required amounts");
      }

      return {
        routeLabel: "Jupiter",
        inputAmount: payload.inAmount,
        outputAmount: payload.outAmount,
        slippageBps: intent.payload.slippageBps,
        estimatedFeeLamports: "5000"
      };
    }
  };
}

export function createDefaultQuoteAdapter(options?: {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  fallbackAdapter?: QuoteAdapter;
}): QuoteAdapter {
  const liveAdapter = createJupiterQuoteAdapter(options);
  const fallbackAdapter = options?.fallbackAdapter ?? createMockQuoteAdapter();

  return {
    async getQuote(intent: SIPIntent): Promise<QuoteResult> {
      try {
        return await liveAdapter.getQuote(intent);
      } catch {
        return fallbackAdapter.getQuote(intent);
      }
    }
  };
}
