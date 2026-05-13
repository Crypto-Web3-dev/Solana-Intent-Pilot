# Execution Experience And Real Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade SIP's execution path so the side panel uses live preflight data, real page context, and clearer wallet-state UX while preserving the existing workflow architecture.

**Architecture:** Keep `background` as the sole orchestrator and add a small local wallet-state layer inside the side panel for UX clarity. Use live-first adapters and page-context helpers behind existing interfaces so the shared runtime contracts stay stable.

**Tech Stack:** TypeScript, React, Plasmo, Vitest, Fetch API, Chrome Extension APIs

---

## Execution Status

This plan has already been implemented in the current workspace.

Implemented areas:

- live-first simulation via RPC preflight with mock fallback
- wallet-state UX in the side panel
- real page context for submit requests
- lightweight real-page hints:
  - `selectedText`
  - `rawHints`
  - `detectedTokens`
- platform-aware token hints for `x.com` and `dexscreener`

Verification status:

- `pnpm -C extension exec tsc --noEmit --pretty false` passes
- `pnpm -C extension test` passes
- `pnpm -C extension build` passes

Notes:

- The implementation follows the plan intent, but some steps were completed before this formal plan was written.
- The plan remains useful as the source-of-truth baseline for future refinement of this slice.

---

### Task 1: Add failing tests for simulation fallback behavior

**Files:**
- Create: `extension/tests/background/simulation-adapter.test.ts`
- Modify: `extension/src/background/simulation-adapter.ts`

- [x] **Step 1: Write the failing test for live RPC preflight success**

```ts
it("uses an RPC preflight response when the provider is healthy", async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      result: {
        context: { slot: 123456 },
        value: { blockhash: "abc", lastValidBlockHeight: 99 }
      }
    })
  });

  const adapter = createDefaultSimulationAdapter({ fetchImpl });
  const result = await adapter.simulate(validIntent);

  expect(result.simulationSummary).toContain("RPC preflight ready");
  expect(result.simulationSummary).toContain("slot 123456");
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `pnpm -C extension test -- simulation-adapter.test.ts`
Expected: FAIL because `createDefaultSimulationAdapter` does not exist yet

- [x] **Step 3: Add the fallback-on-network-failure test**

```ts
it("falls back to the mock adapter when the RPC preflight fails", async () => {
  const fetchImpl = vi.fn().mockRejectedValue(new Error("rpc down"));
  const adapter = createDefaultSimulationAdapter({ fetchImpl });

  const result = await adapter.simulate(validIntent);

  expect(result.simulationSummary).toBe("Mock simulation passed");
});
```

- [x] **Step 4: Add the malformed-response fallback test**

```ts
it("falls back to a custom adapter when the provider data is malformed", async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      result: {
        value: { blockhash: "abc" }
      }
    })
  });

  const fallbackAdapter = {
    simulate: vi.fn().mockResolvedValue({
      simulationSummary: "Fallback simulation"
    })
  };

  const adapter = createDefaultSimulationAdapter({
    fetchImpl,
    fallbackAdapter
  });
  const result = await adapter.simulate(validIntent);

  expect(result.simulationSummary).toBe("Fallback simulation");
});
```

- [x] **Step 5: Run the focused test again**

Run: `pnpm -C extension test -- simulation-adapter.test.ts`
Expected: FAIL for missing implementation only

### Task 2: Implement live-first simulation

**Files:**
- Modify: `extension/src/background/simulation-adapter.ts`
- Modify: `extension/src/background/preview-adapter.ts`

- [x] **Step 1: Add the RPC preflight response types and validation helper**

```ts
type RpcPreflightResponse = {
  result?: {
    context?: { slot?: number };
    value?: { blockhash?: string };
  };
};

function isUsablePreflightResponse(
  response: RpcPreflightResponse
): response is {
  result: {
    context: { slot: number };
    value: { blockhash: string };
  };
} {
  return Boolean(
    response.result?.context?.slot !== undefined &&
      response.result?.value?.blockhash
  );
}
```

- [x] **Step 2: Add the RPC preflight adapter**

```ts
export function createRpcPreflightSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
}): SimulationAdapter {
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  const rpcUrl = options?.rpcUrl ?? "https://api.mainnet-beta.solana.com";

  return {
    async simulate(_intent: SIPIntent): Promise<SimulationResult> {
      if (!fetchImpl) {
        throw new Error("Fetch is unavailable");
      }

      const response = await fetchImpl(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "processed" }]
        })
      });

      if (!response.ok) {
        throw new Error(`RPC preflight failed with status ${response.status}`);
      }

      const payload = (await response.json()) as RpcPreflightResponse;

      if (!isUsablePreflightResponse(payload)) {
        throw new Error("RPC preflight response is missing required fields");
      }

      return {
        simulationSummary: `RPC preflight ready at slot ${payload.result.context.slot}`
      };
    }
  };
}
```

- [x] **Step 3: Add the default simulation adapter with fallback**

```ts
export function createDefaultSimulationAdapter(options?: {
  fetchImpl?: typeof fetch;
  rpcUrl?: string;
  fallbackAdapter?: SimulationAdapter;
}): SimulationAdapter {
  const liveAdapter = createRpcPreflightSimulationAdapter(options);
  const fallbackAdapter =
    options?.fallbackAdapter ?? createMockSimulationAdapter();

  return {
    async simulate(intent: SIPIntent): Promise<SimulationResult> {
      try {
        return await liveAdapter.simulate(intent);
      } catch {
        return fallbackAdapter.simulate(intent);
      }
    }
  };
}
```

- [x] **Step 4: Switch preview defaults to the new simulation adapter**

```ts
const simulationAdapter =
  options?.simulationAdapter ?? createDefaultSimulationAdapter();
```

- [x] **Step 5: Run the focused simulation tests**

Run: `pnpm -C extension test -- simulation-adapter.test.ts`
Expected: PASS

### Task 3: Add wallet-state UX coverage first

**Files:**
- Create: `extension/tests/sidepanel/action-card.test.tsx`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`

- [x] **Step 1: Write the failing wallet-missing UI test**

```tsx
it("shows a wallet-missing hint while waiting for signature", () => {
  const html = renderToString(
    <ActionCard
      preview={preview}
      phase="awaiting-signature"
      reason={null}
      walletStatus="provider-missing"
      isSigning={false}
      onConfirm={() => {}}
      onCancel={() => {}}
      onFailSubmit={() => {}}
      onSettle={() => {}}
      onOpenNormalPage={() => {}}
    />
  );

  expect(html).toContain("No Solana wallet was detected on the current page.");
});
```

- [x] **Step 2: Add the connecting-state test**

```tsx
it("shows an in-progress wallet message while signing", () => {
  const html = renderToString(
    <ActionCard
      preview={preview}
      phase="awaiting-signature"
      reason={null}
      walletStatus="connecting"
      isSigning={true}
      onConfirm={() => {}}
      onCancel={() => {}}
      onFailSubmit={() => {}}
      onSettle={() => {}}
      onOpenNormalPage={() => {}}
    />
  );

  expect(html).toContain("Waiting for your wallet to respond.");
  expect(html).toContain("Confirming...");
});
```

- [x] **Step 3: Run the focused ActionCard tests**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: FAIL because wallet-state props and messaging do not exist yet

### Task 4: Implement wallet-state UX

**Files:**
- Create: `extension/src/sidepanel/wallet-state.ts`
- Modify: `extension/src/sidepanel/wallet-bridge.ts`
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`

- [x] **Step 1: Add the wallet-state type**

```ts
export type WalletStatus =
  | "unknown"
  | "checking"
  | "ready"
  | "provider-missing"
  | "unsupported-page"
  | "connecting"
  | "submitted"
  | "failed";
```

- [x] **Step 2: Add wallet detection in the bridge**

```ts
export async function detectWalletStatus(): Promise<WalletStatus> {
  if (!chromeApi?.tabs?.query || !chromeApi?.scripting?.executeScript) {
    return "failed";
  }

  const tabs = await chromeApi.tabs.query({ currentWindow: true });
  const tab = findSignableTab(tabs);

  if (!tab?.id) {
    return "unsupported-page";
  }

  const results = await chromeApi.scripting.executeScript<boolean>({
    target: { tabId: tab.id },
    world: "MAIN",
    func: () => Boolean((window as Window & { solana?: unknown }).solana)
  });

  return results.at(0)?.result ? "ready" : "provider-missing";
}
```

- [x] **Step 3: Add local wallet state to the side panel hook**

```ts
const [walletStatus, setWalletStatus] = useState<WalletStatus>("unknown");
const [isSigning, setIsSigning] = useState(false);
```

- [x] **Step 4: Detect wallet status on `awaiting-signature`**

```ts
useEffect(() => {
  if (phase !== "awaiting-signature") {
    return;
  }

  let cancelled = false;
  setWalletStatus("checking");

  void detectWalletStatus()
    .then((status) => {
      if (!cancelled) {
        setWalletStatus(status);
      }
    })
    .catch(() => {
      if (!cancelled) {
        setWalletStatus("failed");
      }
    });

  return () => {
    cancelled = true;
  };
}, [phase]);
```

- [x] **Step 5: Render wallet-aware messaging in `ActionCard`**

```tsx
const isWalletReady = walletStatus === "ready";
const walletHint = walletMessage(walletStatus, isSigning);

<button onClick={onConfirm} disabled={!isWalletReady || isSigning}>
  {isSigning ? "Confirming..." : "Confirm Signature"}
</button>
```

- [x] **Step 6: Run the focused ActionCard tests**

Run: `pnpm -C extension test -- action-card.test.tsx`
Expected: PASS

### Task 5: Add failing tests for real page context

**Files:**
- Create: `extension/tests/sidepanel/page-context.test.ts`
- Create or expand: `extension/src/sidepanel/page-context.ts`

- [x] **Step 1: Write the test for choosing the real page tab**

```ts
it("returns the first normal webpage in the current window", () => {
  const context = selectCurrentPageContext(
    [
      { id: 1, url: "chrome-extension://abc/sidepanel.html", title: "SIP" },
      { id: 2, url: "https://x.com/some-post", title: "A post on X" }
    ],
    "NOW"
  );

  expect(context?.tabId).toBe(2);
});
```

- [x] **Step 2: Write the test for missing normal pages**

```ts
it("returns null when no normal webpage is available", () => {
  expect(
    selectCurrentPageContext(
      [{ id: 1, url: "chrome://extensions", title: "Extensions" }],
      "NOW"
    )
  ).toBeNull();
});
```

- [x] **Step 3: Add the raw-hint extraction test**

```ts
it("extracts lightweight raw hints from page text", () => {
  expect(
    extractRawHints("Buy BONK now on Jupiter. Contract address: AbCdEfGh1234567890")
  ).toEqual(["buy", "bonk", "jupiter", "contract", "abcdefgh1234567890"]);
});
```

- [x] **Step 4: Run the focused page-context tests**

Run: `pnpm -C extension test -- page-context.test.ts`
Expected: FAIL because helpers do not exist yet

### Task 6: Implement real page context helpers

**Files:**
- Create or expand: `extension/src/sidepanel/page-context.ts`
- Modify: `extension/src/sidepanel/hooks/useSidePanelState.ts`

- [x] **Step 1: Add page selection and hint helpers**

```ts
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
```

- [x] **Step 2: Add `getCurrentPageContext()` using tabs plus scripting**

```ts
export async function getCurrentPageContext() {
  if (!chromeApi?.tabs?.query) {
    return null;
  }

  const tabs = await chromeApi.tabs.query({ currentWindow: true });
  const baseContext = selectCurrentPageContext(tabs, new Date().toISOString());

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
      // read selected text and page hints
      return {
        selectedText: window.getSelection?.()?.toString().trim() || undefined,
        rawHints: [],
        detectedTokens: []
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
```

- [x] **Step 3: Replace hardcoded submit context with `getCurrentPageContext()`**

```ts
const pageContext = await getCurrentPageContext();

if (!pageContext) {
  setPhase("blocked");
  setReason("unsupported-page");
  setErrorMessage(
    "A normal webpage is required before SIP can parse the current context."
  );
  return;
}
```

- [x] **Step 4: Run the focused page-context and sidepanel tests**

Run: `pnpm -C extension test -- page-context.test.ts sidepanel.test.tsx`
Expected: PASS

### Task 7: Add failing tests for platform-aware token hints

**Files:**
- Modify: `extension/tests/sidepanel/page-context.test.ts`
- Modify: `extension/src/sidepanel/page-context.ts`

- [x] **Step 1: Add the `x.com` cashtag test**

```ts
it("extracts token hints for x.com cashtags", () => {
  expect(
    extractDetectedTokens(
      "https://x.com/some-post",
      "A post about $BONK and $WIF"
    )
  ).toEqual([
    { symbol: "BONK", source: "twitter", confidence: 0.82 },
    { symbol: "WIF", source: "twitter", confidence: 0.82 }
  ]);
});
```

- [x] **Step 2: Add the Dexscreener mint-hint test**

```ts
it("extracts a high-confidence mint hint from Dexscreener pages", () => {
  expect(
    extractDetectedTokens(
      "https://dexscreener.com/solana/9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s",
      "BONK / SOL pair"
    )
  ).toEqual([
    {
      mint: "9xQeWvG816bUx9EPjHmaT23yvVM3q4a9F98z4hTaz8s",
      source: "dexscreener",
      confidence: 0.92
    },
    { symbol: "BONK", source: "dexscreener", confidence: 0.72 },
    { symbol: "SOL", source: "dexscreener", confidence: 0.72 }
  ]);
});
```

- [x] **Step 3: Run the focused page-context tests**

Run: `pnpm -C extension test -- page-context.test.ts`
Expected: FAIL because `extractDetectedTokens` does not exist yet

### Task 8: Implement platform-aware token hints

**Files:**
- Modify: `extension/src/sidepanel/page-context.ts`

- [x] **Step 1: Add source detection and dedupe helpers**

```ts
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
```

- [x] **Step 2: Add `extractDetectedTokens(url, text)`**

```ts
export function extractDetectedTokens(url: string, text: string) {
  const source = detectSource(url);
  const hints: TokenHint[] = [];
  const cashtags = Array.from(
    new Set(Array.from(text.matchAll(/\$([A-Z0-9]{2,10})/g), (match) => match[1]))
  );

  // add source-specific mint and symbol hints here
  return uniqueTokenHints(hints).slice(0, 3);
}
```

- [x] **Step 3: Use detected tokens inside page-context scripting**

```ts
const detectedTokens = extractDetectedTokensLikeLogic(window.location.href, pageText);
```

- [x] **Step 4: Run the focused page-context tests**

Run: `pnpm -C extension test -- page-context.test.ts`
Expected: PASS

### Task 9: Verify the full slice

**Files:**
- Modify: `docs/superpowers/specs/2026-04-19-execution-experience-real-context-design.md`
- Modify: `docs/superpowers/plans/2026-04-19-execution-experience-real-context.md`

- [x] **Step 1: Run type-check**

Run: `pnpm -C extension exec tsc --noEmit --pretty false`
Expected: PASS

- [x] **Step 2: Run the full extension test suite**

Run: `pnpm -C extension test`
Expected: PASS

- [x] **Step 3: Run the extension build**

Run: `pnpm -C extension build`
Expected: PASS

- [x] **Step 4: Update docs if implementation differs from plan**

Adjust the spec or plan inline if naming or exact UI wording changed during implementation.
