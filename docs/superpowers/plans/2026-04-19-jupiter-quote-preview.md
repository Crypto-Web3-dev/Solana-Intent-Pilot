# Jupiter Quote Preview Implementation Plan

## Execution Status

Completed:

- Added a Jupiter-backed default quote adapter
- Preserved mock fallback for live quote failures
- Kept the existing preview pipeline and runtime contract stable
- Added tests for live mapping and fallback behavior

Fallback behavior still in place:

- If Jupiter is unavailable, the mock quote adapter is used
- Preview composition still works in local development without network access

Validation:

- `pnpm -C extension exec tsc --noEmit --pretty false`
- `pnpm -C extension test`
- `pnpm -C extension build`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock-only preview quote source with a Jupiter-backed default quote adapter that falls back to mock data when the live provider is unavailable.

**Architecture:** Keep the existing preview pipeline intact and only upgrade the quote adapter boundary. The default quote adapter will try Jupiter first, validate the minimum response shape, map it into `QuoteResult`, and fall back to the existing mock adapter on failure.

**Tech Stack:** TypeScript, Plasmo extension runtime, Vitest, Fetch API

---

### Task 1: Add failing tests for the default quote adapter

**Files:**
- Create: `extension/tests/background/quote-adapter.test.ts`
- Modify: `extension/src/background/quote-adapter.ts`

- [x] **Step 1: Write the failing test for successful Jupiter mapping**

```ts
import { describe, expect, it, vi } from "vitest";
import { createDefaultQuoteAdapter } from "../../src/background/quote-adapter";

describe("default quote adapter", () => {
  it("maps a Jupiter quote response into QuoteResult", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        inAmount: "1000000000",
        outAmount: "250000000"
      })
    });

    const adapter = createDefaultQuoteAdapter({ fetchImpl });
    const result = await adapter.getQuote(validIntent);

    expect(result.routeLabel).toBe("Jupiter");
    expect(result.inputAmount).toBe("1000000000");
    expect(result.outputAmount).toBe("250000000");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm -C extension test -- quote-adapter.test.ts`
Expected: FAIL because `createDefaultQuoteAdapter` does not exist yet

- [x] **Step 3: Add the fallback test for provider failure**

```ts
it("falls back to the mock adapter when Jupiter fetch fails", async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
  const adapter = createDefaultQuoteAdapter({ fetchImpl });

  const result = await adapter.getQuote(validIntent);

  expect(result.routeLabel).toBe("Jupiter");
  expect(result.inputAmount).toBe("1 SOL");
  expect(result.outputAmount).toBe("100 USDC");
});
```

- [x] **Step 4: Add the fallback test for malformed provider data**

```ts
it("falls back to mock when Jupiter returns unusable data", async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ outAmount: "250000000" })
  });

  const adapter = createDefaultQuoteAdapter({ fetchImpl });
  const result = await adapter.getQuote(validIntent);

  expect(result.inputAmount).toBe("1 SOL");
  expect(result.outputAmount).toBe("100 USDC");
});
```

- [x] **Step 5: Run the focused test file again**

Run: `pnpm -C extension test -- quote-adapter.test.ts`
Expected: FAIL with missing implementation, not syntax errors

### Task 2: Implement the Jupiter-backed quote adapter

**Files:**
- Modify: `extension/src/background/quote-adapter.ts`

- [x] **Step 1: Add the Jupiter response types and helper**

```ts
type JupiterQuoteResponse = {
  inAmount?: string;
  outAmount?: string;
};

function isUsableQuoteResponse(
  response: JupiterQuoteResponse
): response is Required<JupiterQuoteResponse> {
  return Boolean(response.inAmount && response.outAmount);
}
```

- [x] **Step 2: Add the live adapter implementation**

```ts
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
```

- [x] **Step 3: Add the default adapter with fallback**

```ts
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
```

- [x] **Step 4: Run the focused quote adapter tests**

Run: `pnpm -C extension test -- quote-adapter.test.ts`
Expected: PASS

### Task 3: Wire the default quote adapter into preview generation

**Files:**
- Modify: `extension/src/background/preview-adapter.ts`
- Modify: `extension/src/background/runtime-services.ts`

- [x] **Step 1: Switch preview adapter defaults to the new default quote adapter**

```ts
import { createDefaultQuoteAdapter, createMockQuoteAdapter } from "./quote-adapter";

const quoteAdapter = options?.quoteAdapter ?? createDefaultQuoteAdapter();
```

- [x] **Step 2: Keep runtime services stable**

```ts
export function createMockRuntimeServices(): RuntimeServices {
  const parser = createDefaultIntentParser();
  const riskAdapter = createDefaultRiskAdapter();
  const previewAdapter = createPolicyPreviewAdapter();

  return {
    parseIntent: parser.parseIntent,
    scanRisk: riskAdapter.scanRisk,
    buildPreview: previewAdapter.buildPreview
  };
}
```

- [x] **Step 3: Run preview-related tests**

Run: `pnpm -C extension test -- workflow-engine.test.ts`
Expected: PASS

### Task 4: Verify the full slice

**Files:**
- Modify: `docs/superpowers/specs/2026-04-19-jupiter-quote-preview-design.md`
- Modify: `docs/superpowers/plans/2026-04-19-jupiter-quote-preview.md`

- [x] **Step 1: Run type-check**

Run: `pnpm -C extension exec tsc --noEmit --pretty false`
Expected: PASS

- [x] **Step 2: Run the full extension test suite**

Run: `pnpm -C extension test`
Expected: PASS

- [x] **Step 3: Run the extension build**

Run: `pnpm -C extension build`
Expected: PASS

- [x] **Step 4: Update docs if implementation differs from spec**

Adjust the spec or plan inline if naming or fallback behavior changed during implementation.
