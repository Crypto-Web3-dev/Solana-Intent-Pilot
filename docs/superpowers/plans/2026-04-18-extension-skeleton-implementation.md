# Extension Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable mock-first SIP extension skeleton with shared runtime contracts, a background workflow engine, a side panel UI shell, and a mocked parse -> risk -> preview flow.

**Architecture:** Create a minimal `extension/` app where `shared/` is the single source of runtime types, `background/` owns workflow orchestration, `sidepanel/` only renders state and sends user actions, and `content/` emits a minimal context snapshot. All external systems stay mocked so we can validate the document-defined contracts and state machine before integrating real services.

**Tech Stack:** TypeScript, React, Vitest, Vite, Plasmo

## Execution Status

- Status: completed
- Execution date: 2026-04-18
- Implementation commit: `2529553` (`feat: add mock-first SIP extension skeleton`)
- Task result: Tasks 1-7 are complete at the goal level
- Notable deviation: `extension/vite.config.ts` was replaced by `extension/scripts/run-vitest.mjs` plus `pnpm -C extension test` because the default Vitest config-loading path hit `spawn EPERM` in this Windows environment
- Notable deviation: the implemented side panel, workflow engine, and message contracts go beyond the minimum skeleton in this plan so they stay aligned with the final `docs/` contract set
- Verification:
  - `pnpm -C extension exec tsc --noEmit --pretty false`
  - `pnpm -C extension test`
  - `pnpm -C extension build`

---

## File Structure

### New files to create

- `extension/package.json`
- `extension/tsconfig.json`
- `extension/vite.config.ts`
- `extension/src/shared/context.ts`
- `extension/src/shared/intent.ts`
- `extension/src/shared/risk.ts`
- `extension/src/shared/execution.ts`
- `extension/src/shared/workflow.ts`
- `extension/src/shared/messages.ts`
- `extension/src/background/workflow-engine.ts`
- `extension/src/background/mock-services.ts`
- `extension/src/background/message-router.ts`
- `extension/src/content/detect-context.ts`
- `extension/src/sidepanel/pages/SidePanelPage.tsx`
- `extension/src/sidepanel/hooks/useSidePanelState.ts`
- `extension/src/sidepanel/components/DetectionBar.tsx`
- `extension/src/sidepanel/components/IntentSummaryCard.tsx`
- `extension/src/sidepanel/components/RiskIndicator.tsx`
- `extension/src/sidepanel/components/ActionCard.tsx`
- `extension/tests/shared/contracts.test.ts`
- `extension/tests/background/workflow-engine.test.ts`

### Files not to create in this plan

- No real RPC adapters
- No real LLM client
- No real wallet integration
- No Rust/Wasm files yet

## Task 1: Scaffold the extension workspace

**Files:**
- Create: `extension/package.json`
- Create: `extension/tsconfig.json`
- Create: `extension/vite.config.ts`

- [x] **Step 1: Write the failing workspace smoke test**

Create `extension/tests/shared/contracts.test.ts` with:

```ts
import { describe, expect, it } from "vitest";

describe("workspace smoke test", () => {
  it("can import the shared contracts module", async () => {
    await expect(import("../../src/shared/workflow")).resolves.toBeDefined();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --dir extension vitest run extension/tests/shared/contracts.test.ts`
Expected: FAIL because `extension/package.json` and source files do not exist yet

- [x] **Step 3: Write minimal workspace scaffolding**

Create `extension/package.json`:

```json
{
  "name": "sip-extension",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "plasmo dev",
    "build": "plasmo build",
    "test": "vitest run"
  },
  "dependencies": {
    "@plasmohq/storage": "^1.10.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "plasmo": "^0.90.5",
    "typescript": "^5.6.3",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

Create `extension/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": "."
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

Create `extension/vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node"
  }
});
```

- [x] **Step 4: Add the minimal shared file needed for the smoke test**

Create `extension/src/shared/workflow.ts`:

```ts
export type WorkflowPhase =
  | "idle"
  | "detecting"
  | "parsing"
  | "risk-checking"
  | "quoting"
  | "simulating"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "failed"
  | "blocked";

export type WorkflowReason =
  | "context-refresh"
  | "intent-invalid"
  | "clarification-required"
  | "risk-blocked"
  | "risk-check-failed"
  | "quote-failed"
  | "simulation-failed"
  | "signature-cancelled"
  | "submit-failed"
  | "confirmed";
```

- [x] **Step 5: Run the smoke test to verify it passes**

Run: `pnpm --dir extension vitest run tests/shared/contracts.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/package.json extension/tsconfig.json extension/vite.config.ts extension/src/shared/workflow.ts extension/tests/shared/contracts.test.ts
git commit -m "chore: scaffold extension workspace"
```

## Task 2: Add shared runtime contracts

**Files:**
- Create: `extension/src/shared/context.ts`
- Create: `extension/src/shared/intent.ts`
- Create: `extension/src/shared/risk.ts`
- Create: `extension/src/shared/execution.ts`
- Create: `extension/src/shared/messages.ts`
- Modify: `extension/tests/shared/contracts.test.ts`

- [x] **Step 1: Write the failing contract tests**

Replace `extension/tests/shared/contracts.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { DetectedContextSnapshot } from "../../src/shared/context";
import type { ExecutionPreview } from "../../src/shared/execution";
import type { SIPIntent } from "../../src/shared/intent";
import type { WorkflowStateChangedMessage } from "../../src/shared/messages";
import type { SecurityReport } from "../../src/shared/risk";

describe("shared runtime contracts", () => {
  it("supports a valid SIP intent shape", () => {
    const intent: SIPIntent = {
      intent: "SWAP",
      confidence: 0.92,
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      },
      metadata: {
        reasoning: "Swap to USDC",
        requiresRiskScan: true,
        sourceContext: ["page-token"],
        needsClarification: false
      }
    };

    expect(intent.intent).toBe("SWAP");
  });

  it("supports unknown risk level without creating a workflow phase", () => {
    const report: SecurityReport = {
      score: 0,
      level: "unknown",
      blocking: false,
      checks: [],
      summary: "Insufficient data"
    };

    expect(report.level).toBe("unknown");
  });

  it("supports execution preview payloads", () => {
    const preview: ExecutionPreview = {
      requestId: "req-1",
      routeLabel: "Jupiter",
      inputAmount: "1 SOL",
      outputAmount: "100 USDC",
      slippageBps: 50,
      estimatedFeeLamports: "5000"
    };

    expect(preview.requestId).toBe("req-1");
  });

  it("supports workflow state changed messages", () => {
    const message: WorkflowStateChangedMessage = {
      type: "workflow.state.changed",
      payload: {
        requestId: "req-1",
        phase: "parsing",
        reason: "context-refresh"
      }
    };

    expect(message.payload.phase).toBe("parsing");
  });

  it("supports detected context snapshots", () => {
    const context: DetectedContextSnapshot = {
      tabId: 1,
      url: "https://example.com",
      title: "Example",
      detectedTokens: [],
      rawHints: [],
      detectedAt: "2026-04-18T00:00:00.000Z"
    };

    expect(context.tabId).toBe(1);
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir extension vitest run tests/shared/contracts.test.ts`
Expected: FAIL because the shared contract files do not exist

- [x] **Step 3: Implement context and intent contracts**

Create `extension/src/shared/context.ts`:

```ts
export interface TokenHint {
  symbol?: string;
  mint?: string;
  source: "twitter" | "birdeye" | "dexscreener" | "generic";
  confidence: number;
}

export interface DetectedContextSnapshot {
  tabId: number;
  url: string;
  title: string;
  selectedText?: string;
  detectedTokens: TokenHint[];
  rawHints: string[];
  detectedAt: string;
}
```

Create `extension/src/shared/intent.ts`:

```ts
export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";
export type AmountMode = "exact" | "half" | "all";

export interface SIPIntent {
  intent: IntentType;
  confidence: number;
  payload: {
    inputMint: string;
    outputMint: string;
    amount: string;
    amountMode: AmountMode;
    slippageBps: number;
    platform: string;
  };
  metadata: {
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
  };
}
```

- [x] **Step 4: Implement risk, execution, and message contracts**

Create `extension/src/shared/risk.ts`:

```ts
export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface SecurityReport {
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  summary: string;
}
```

Create `extension/src/shared/execution.ts`:

```ts
export interface ExecutionPreview {
  requestId: string;
  routeLabel: string;
  inputAmount: string;
  outputAmount: string;
  slippageBps: number;
  estimatedFeeLamports: string;
  simulationSummary?: string;
}
```

Create `extension/src/shared/messages.ts`:

```ts
import type { DetectedContextSnapshot } from "./context";
import type { ExecutionPreview } from "./execution";
import type { SIPIntent } from "./intent";
import type { SecurityReport } from "./risk";
import type { WorkflowPhase, WorkflowReason } from "./workflow";

export interface ContextDetectedMessage {
  type: "context.detected";
  payload: DetectedContextSnapshot;
}

export interface IntentParseRequestedMessage {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
  };
}

export interface WorkflowStateChangedMessage {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase: WorkflowPhase;
    reason?: WorkflowReason | string;
  };
}

export interface RiskScanCompletedMessage {
  type: "risk.scan.completed";
  payload: {
    requestId: string;
    report: SecurityReport;
  };
}

export interface ExecutionPreviewReadyMessage {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
}

export interface IntentParseSucceededMessage {
  type: "intent.parse.succeeded";
  payload: {
    requestId: string;
    intent: SIPIntent;
  };
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pnpm --dir extension vitest run tests/shared/contracts.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/src/shared extension/tests/shared/contracts.test.ts
git commit -m "feat: add shared runtime contracts"
```

## Task 3: Build the workflow engine with TDD

**Files:**
- Create: `extension/src/background/workflow-engine.ts`
- Create: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Write the failing workflow engine tests**

Create `extension/tests/background/workflow-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SIPIntent } from "../../src/shared/intent";
import type { SecurityReport } from "../../src/shared/risk";
import { createWorkflowEngine } from "../../src/background/workflow-engine";

const validIntent: SIPIntent = {
  intent: "SWAP",
  confidence: 0.92,
  payload: {
    inputMint: "So11111111111111111111111111111111111111112",
    outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    amount: "1000000000",
    amountMode: "exact",
    slippageBps: 50,
    platform: "Jupiter"
  },
  metadata: {
    reasoning: "Swap to USDC",
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

describe("workflow engine", () => {
  it("advances to awaiting-signature for a happy path", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1");
    engine.handleParsedIntent("req-1", validIntent);
    engine.handleRiskReport("req-1", happyRisk);
    engine.handlePreviewReady("req-1");

    expect(engine.getState("req-1")?.phase).toBe("awaiting-signature");
  });

  it("returns to idle when clarification is required", () => {
    const engine = createWorkflowEngine();

    engine.start("req-2");
    engine.handleParsedIntent("req-2", {
      ...validIntent,
      confidence: 0.3,
      metadata: {
        ...validIntent.metadata,
        needsClarification: true
      }
    });

    expect(engine.getState("req-2")?.phase).toBe("idle");
    expect(engine.getState("req-2")?.reason).toBe("clarification-required");
  });

  it("moves to blocked when risk is blocking", () => {
    const engine = createWorkflowEngine();
    const blockedRisk: SecurityReport = {
      score: 10,
      level: "high",
      blocking: true,
      checks: [],
      summary: "Mint authority present"
    };

    engine.start("req-3");
    engine.handleParsedIntent("req-3", validIntent);
    engine.handleRiskReport("req-3", blockedRisk);

    expect(engine.getState("req-3")?.phase).toBe("blocked");
  });

  it("moves to failed when preview generation fails", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-4");
    engine.handleParsedIntent("req-4", validIntent);
    engine.handleRiskReport("req-4", happyRisk);
    engine.handleFailure("req-4", "quote-failed");

    expect(engine.getState("req-4")?.phase).toBe("failed");
  });
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pnpm --dir extension vitest run tests/background/workflow-engine.test.ts`
Expected: FAIL because `createWorkflowEngine` does not exist

- [x] **Step 3: Implement the minimal workflow engine**

Create `extension/src/background/workflow-engine.ts`:

```ts
import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../shared/workflow";

type WorkflowState = {
  requestId: string;
  phase: WorkflowPhase;
  reason?: WorkflowReason | string;
};

export function createWorkflowEngine() {
  const states = new Map<string, WorkflowState>();

  function setState(
    requestId: string,
    phase: WorkflowPhase,
    reason?: WorkflowReason | string
  ) {
    states.set(requestId, { requestId, phase, reason });
  }

  return {
    start(requestId: string) {
      setState(requestId, "parsing");
    },
    handleParsedIntent(requestId: string, intent: SIPIntent) {
      if (intent.metadata.needsClarification) {
        setState(requestId, "idle", "clarification-required");
        return;
      }

      setState(
        requestId,
        intent.metadata.requiresRiskScan ? "risk-checking" : "quoting"
      );
    },
    handleRiskReport(requestId: string, report: SecurityReport) {
      if (report.blocking) {
        setState(requestId, "blocked", "risk-blocked");
        return;
      }

      setState(requestId, "quoting");
    },
    handlePreviewReady(requestId: string) {
      setState(requestId, "awaiting-signature");
    },
    handleFailure(requestId: string, reason: WorkflowReason | string) {
      setState(requestId, "failed", reason);
    },
    getState(requestId: string) {
      return states.get(requestId);
    }
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pnpm --dir extension vitest run tests/background/workflow-engine.test.ts`
Expected: PASS

- [x] **Step 5: Run all tests**

Run: `pnpm --dir extension vitest run`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/src/background/workflow-engine.ts extension/tests/background/workflow-engine.test.ts
git commit -m "feat: add workflow engine skeleton"
```

## Task 4: Add mock services and message router

**Files:**
- Create: `extension/src/background/mock-services.ts`
- Create: `extension/src/background/message-router.ts`
- Modify: `extension/src/shared/messages.ts`
- Test: `extension/tests/background/workflow-engine.test.ts`

- [x] **Step 1: Write the failing router test**

Append to `extension/tests/background/workflow-engine.test.ts`:

```ts
import { createMessageRouter } from "../../src/background/message-router";

it("routes an intent request through parse, risk, and preview", async () => {
  const router = createMessageRouter();

  const events = await router.handleIntentRequest({
    type: "intent.parse.requested",
    payload: {
      requestId: "req-5",
      tabId: 1,
      userInput: "buy 1 SOL of this",
      contextSnapshot: {
        tabId: 1,
        url: "https://example.com",
        title: "Example",
        detectedTokens: [],
        rawHints: [],
        detectedAt: "2026-04-18T00:00:00.000Z"
      }
    }
  });

  expect(events.at(-1)?.type).toBe("execution.preview.ready");
});
```

- [x] **Step 2: Run the router test to verify it fails**

Run: `pnpm --dir extension vitest run tests/background/workflow-engine.test.ts`
Expected: FAIL because router and mock services do not exist

- [x] **Step 3: Add the missing message type and mock services**

Append to `extension/src/shared/messages.ts`:

```ts
export interface RiskScanRequestedMessage {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    sourceIntent: SIPIntent["payload"];
  };
}

export type SIPRuntimeMessage =
  | ContextDetectedMessage
  | IntentParseRequestedMessage
  | IntentParseSucceededMessage
  | RiskScanRequestedMessage
  | RiskScanCompletedMessage
  | ExecutionPreviewReadyMessage
  | WorkflowStateChangedMessage;
```

Create `extension/src/background/mock-services.ts`:

```ts
import type { ExecutionPreview } from "../shared/execution";
import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";

export async function mockParseIntent(input: string): Promise<SIPIntent> {
  if (input.includes("unclear")) {
    return {
      intent: "SWAP",
      confidence: 0.3,
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "0",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      },
      metadata: {
        reasoning: "Need clarification",
        requiresRiskScan: false,
        sourceContext: ["user-input"],
        needsClarification: true
      }
    };
  }

  return {
    intent: "SWAP",
    confidence: 0.92,
    payload: {
      inputMint: "So11111111111111111111111111111111111111112",
      outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "1000000000",
      amountMode: "exact",
      slippageBps: 50,
      platform: "Jupiter"
    },
    metadata: {
      reasoning: "Swap to USDC",
      requiresRiskScan: true,
      sourceContext: ["page-token"],
      needsClarification: false
    }
  };
}

export async function mockRiskScan(intent: SIPIntent): Promise<SecurityReport> {
  if (intent.payload.outputMint.includes("blocked")) {
    return {
      score: 10,
      level: "high",
      blocking: true,
      checks: [],
      summary: "Blocked token"
    };
  }

  return {
    score: 90,
    level: "low",
    blocking: false,
    checks: [],
    summary: "Safe enough for demo"
  };
}

export async function mockExecutionPreview(
  requestId: string
): Promise<ExecutionPreview> {
  return {
    requestId,
    routeLabel: "Jupiter",
    inputAmount: "1 SOL",
    outputAmount: "100 USDC",
    slippageBps: 50,
    estimatedFeeLamports: "5000",
    simulationSummary: "Mock simulation passed"
  };
}
```

- [x] **Step 4: Implement the message router**

Create `extension/src/background/message-router.ts`:

```ts
import {
  mockExecutionPreview,
  mockParseIntent,
  mockRiskScan
} from "./mock-services";
import { createWorkflowEngine } from "./workflow-engine";
import type {
  ExecutionPreviewReadyMessage,
  IntentParseRequestedMessage,
  SIPRuntimeMessage
} from "../shared/messages";

export function createMessageRouter() {
  const engine = createWorkflowEngine();

  return {
    async handleIntentRequest(
      message: IntentParseRequestedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId, userInput } = message.payload;
      const events: SIPRuntimeMessage[] = [];

      engine.start(requestId);
      events.push({
        type: "workflow.state.changed",
        payload: { requestId, phase: "parsing" }
      });

      const intent = await mockParseIntent(userInput);
      events.push({
        type: "intent.parse.succeeded",
        payload: { requestId, intent }
      });

      engine.handleParsedIntent(requestId, intent);
      events.push({
        type: "workflow.state.changed",
        payload: engine.getState(requestId)!
      });

      if (intent.metadata.needsClarification) {
        return events;
      }

      const risk = await mockRiskScan(intent);
      engine.handleRiskReport(requestId, risk);
      events.push({
        type: "risk.scan.completed",
        payload: { requestId, report: risk }
      });
      events.push({
        type: "workflow.state.changed",
        payload: engine.getState(requestId)!
      });

      if (risk.blocking) {
        return events;
      }

      engine.handlePreviewReady(requestId);
      const preview = await mockExecutionPreview(requestId);
      const previewMessage: ExecutionPreviewReadyMessage = {
        type: "execution.preview.ready",
        payload: preview
      };

      events.push(previewMessage);
      events.push({
        type: "workflow.state.changed",
        payload: engine.getState(requestId)!
      });

      return events;
    }
  };
}
```

- [x] **Step 5: Run the router test to verify it passes**

Run: `pnpm --dir extension vitest run tests/background/workflow-engine.test.ts`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/src/background/mock-services.ts extension/src/background/message-router.ts extension/src/shared/messages.ts extension/tests/background/workflow-engine.test.ts
git commit -m "feat: add mock workflow router"
```

## Task 5: Add the side panel shell and state hook

**Files:**
- Create: `extension/src/sidepanel/pages/SidePanelPage.tsx`
- Create: `extension/src/sidepanel/hooks/useSidePanelState.ts`
- Create: `extension/src/sidepanel/components/DetectionBar.tsx`
- Create: `extension/src/sidepanel/components/IntentSummaryCard.tsx`
- Create: `extension/src/sidepanel/components/RiskIndicator.tsx`
- Create: `extension/src/sidepanel/components/ActionCard.tsx`

- [x] **Step 1: Write the failing UI smoke test**

Create `extension/tests/sidepanel/sidepanel.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SidePanelPage } from "../../src/sidepanel/pages/SidePanelPage";

describe("SidePanelPage", () => {
  it("renders a mock workflow summary", () => {
    const html = renderToString(<SidePanelPage />);
    expect(html).toContain("SIP Side Panel");
    expect(html).toContain("Submit Mock Intent");
  });
});
```

- [x] **Step 2: Run the UI test to verify it fails**

Run: `pnpm --dir extension vitest run tests/sidepanel/sidepanel.test.tsx`
Expected: FAIL because the page and components do not exist

- [x] **Step 3: Implement the minimal state hook**

Create `extension/src/sidepanel/hooks/useSidePanelState.ts`:

```ts
import { useState } from "react";
import { createMessageRouter } from "../../background/message-router";
import type { ExecutionPreview } from "../../shared/execution";
import type { SIPIntent } from "../../shared/intent";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase } from "../../shared/workflow";

const router = createMessageRouter();

export function useSidePanelState() {
  const [phase, setPhase] = useState<WorkflowPhase>("idle");
  const [intent, setIntent] = useState<SIPIntent | null>(null);
  const [risk, setRisk] = useState<SecurityReport | null>(null);
  const [preview, setPreview] = useState<ExecutionPreview | null>(null);

  async function submit(userInput: string) {
    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-ui-1",
        tabId: 1,
        userInput,
        contextSnapshot: {
          tabId: 1,
          url: "https://example.com",
          title: "Example",
          detectedTokens: [],
          rawHints: [],
          detectedAt: new Date().toISOString()
        }
      }
    });

    for (const event of events) {
      if (event.type === "workflow.state.changed") {
        setPhase(event.payload.phase);
      }
      if (event.type === "intent.parse.succeeded") {
        setIntent(event.payload.intent);
      }
      if (event.type === "risk.scan.completed") {
        setRisk(event.payload.report);
      }
      if (event.type === "execution.preview.ready") {
        setPreview(event.payload);
      }
    }
  }

  return { phase, intent, risk, preview, submit };
}
```

- [x] **Step 4: Implement the minimal UI components**

Create `extension/src/sidepanel/components/DetectionBar.tsx`:

```tsx
export function DetectionBar() {
  return <div>Detected Context Ready</div>;
}
```

Create `extension/src/sidepanel/components/IntentSummaryCard.tsx`:

```tsx
import type { SIPIntent } from "../../shared/intent";

export function IntentSummaryCard({ intent }: { intent: SIPIntent | null }) {
  if (!intent) return <div>No intent yet</div>;
  return <div>{intent.metadata.reasoning}</div>;
}
```

Create `extension/src/sidepanel/components/RiskIndicator.tsx`:

```tsx
import type { SecurityReport } from "../../shared/risk";

export function RiskIndicator({ risk }: { risk: SecurityReport | null }) {
  if (!risk) return <div>No risk report yet</div>;
  return <div>Risk: {risk.level}</div>;
}
```

Create `extension/src/sidepanel/components/ActionCard.tsx`:

```tsx
import type { ExecutionPreview } from "../../shared/execution";
import type { WorkflowPhase } from "../../shared/workflow";

export function ActionCard({
  preview,
  phase
}: {
  preview: ExecutionPreview | null;
  phase: WorkflowPhase;
}) {
  if (!preview) return <div>Phase: {phase}</div>;
  return <div>{preview.routeLabel}</div>;
}
```

Create `extension/src/sidepanel/pages/SidePanelPage.tsx`:

```tsx
import { useState } from "react";
import { DetectionBar } from "../components/DetectionBar";
import { IntentSummaryCard } from "../components/IntentSummaryCard";
import { RiskIndicator } from "../components/RiskIndicator";
import { ActionCard } from "../components/ActionCard";
import { useSidePanelState } from "../hooks/useSidePanelState";

export function SidePanelPage() {
  const [input, setInput] = useState("buy 1 SOL of this");
  const { phase, intent, risk, preview, submit } = useSidePanelState();

  return (
    <main>
      <h1>SIP Side Panel</h1>
      <DetectionBar />
      <input value={input} onChange={(event) => setInput(event.target.value)} />
      <button onClick={() => void submit(input)}>Submit Mock Intent</button>
      <div>Workflow: {phase}</div>
      <IntentSummaryCard intent={intent} />
      <RiskIndicator risk={risk} />
      <ActionCard preview={preview} phase={phase} />
    </main>
  );
}
```

- [x] **Step 5: Run the UI test to verify it passes**

Run: `pnpm --dir extension vitest run tests/sidepanel/sidepanel.test.tsx`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/src/sidepanel extension/tests/sidepanel/sidepanel.test.tsx
git commit -m "feat: add sidepanel mock ui shell"
```

## Task 6: Add the content script skeleton

**Files:**
- Create: `extension/src/content/detect-context.ts`

- [x] **Step 1: Write the failing content contract test**

Create `extension/tests/content/detect-context.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMockDetectedContext } from "../../src/content/detect-context";

describe("detect context", () => {
  it("builds a serializable mock context payload", () => {
    const context = buildMockDetectedContext();
    expect(context.url).toBeTypeOf("string");
    expect(Array.isArray(context.detectedTokens)).toBe(true);
  });
});
```

- [x] **Step 2: Run the content test to verify it fails**

Run: `pnpm --dir extension vitest run tests/content/detect-context.test.ts`
Expected: FAIL because the module does not exist

- [x] **Step 3: Implement the minimal content helper**

Create `extension/src/content/detect-context.ts`:

```ts
import type { DetectedContextSnapshot } from "../shared/context";

export function buildMockDetectedContext(): DetectedContextSnapshot {
  return {
    tabId: 1,
    url: "https://example.com",
    title: "Example Page",
    selectedText: "buy this token",
    detectedTokens: [],
    rawHints: ["example"],
    detectedAt: new Date().toISOString()
  };
}
```

- [x] **Step 4: Run the content test to verify it passes**

Run: `pnpm --dir extension vitest run tests/content/detect-context.test.ts`
Expected: PASS

- [x] **Step 5: Run the full test suite**

Run: `pnpm --dir extension vitest run`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add extension/src/content/detect-context.ts extension/tests/content/detect-context.test.ts
git commit -m "feat: add content context skeleton"
```

## Task 7: Verify the extension build skeleton

**Files:**
- Modify: `extension/package.json` if build scripts need adjustment

- [x] **Step 1: Run the test suite as a final contract check**

Run: `pnpm --dir extension vitest run`
Expected: PASS

- [x] **Step 2: Run the extension build**

Run: `pnpm --dir extension build`
Expected: build output generated by Plasmo, or a precise missing-entry error that tells us which extension entry file still needs to be added

- [x] **Step 3: If build fails only because an entry file is missing, add the minimal entry wrapper**

Create `extension/src/sidepanel/index.tsx` if needed:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { SidePanelPage } from "./pages/SidePanelPage";

const container = document.createElement("div");
document.body.appendChild(container);
createRoot(container).render(<SidePanelPage />);
```

- [x] **Step 4: Re-run the build**

Run: `pnpm --dir extension build`
Expected: successful build or a narrower integration issue to address in the next plan

- [x] **Step 5: Commit**

```bash
git add extension
git commit -m "feat: add mock-first extension skeleton"
```

## Self-Review

### Spec coverage

- Shared runtime contracts: covered in Tasks 1-2
- Background workflow engine: covered in Tasks 3-4
- Side panel UI shell: covered in Task 5
- Content detection entry: covered in Task 6
- Mock-first vertical flow: covered in Tasks 4-5
- Tests for workflow behavior: covered in Tasks 1-7

### Placeholder scan

- No `TBD`, `TODO`, or omitted commands
- All file paths are explicit
- Code steps include code

### Type consistency

- `WorkflowPhase`, `WorkflowReason`, `SIPIntent`, `SecurityReport`, and `ExecutionPreview` use the same names across tasks
- `needsClarification` remains metadata, not a workflow phase
