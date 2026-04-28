import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

import { createMessageRouter } from "../../src/background/message-router";
import { createMockIntentParser } from "../../src/background/intent-parser";
import { normalizeIntentWithContext } from "../../src/background/openai-intent-parser";
import {
  createMockPreviewAdapter,
  createPolicyPreviewAdapter
} from "../../src/background/preview-adapter";
import { createMockQuoteAdapter } from "../../src/background/quote-adapter";
import {
  createMockRiskAdapter,
  createPolicyRiskAdapter
} from "../../src/background/risk-adapter";
import { createMockSimulationAdapter } from "../../src/background/simulation-adapter";
import { createMockRuntimeServices } from "../../src/background/runtime-services";
import type { SIPIntent } from "../../src/shared/intent";
import type {
  ExecutionCancelledMessage,
  ExecutionConfirmedMessage,
  IntentParseFailedMessage,
  SIPRuntimeMessage,
  TransactionFailedMessage,
  TransactionSettledMessage,
  TransactionSubmittedMessage,
  WorkflowStateChangedMessage
} from "../../src/shared/messages";
import type { SecurityReport } from "../../src/shared/risk";
import {
  createWorkflowEngine,
  isTerminalPhase
} from "../../src/background/workflow-engine";

const validIntent: SIPIntent = {
  intentId: "test-intent-id",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      status: "pending",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      }
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap to USDC",
    reasoning: "Swap to USDC",
    estimatedNetChange: { spend: "1 SOL", receive: "100 USDC" },
    jitoTipLamports: 1000,
    requiresRiskScan: true,
    sourceContext: ["page-token"],
    needsClarification: false
  }
};

function getWorkflowStates(events: SIPRuntimeMessage[]) {
  return events.filter(
    (event): event is WorkflowStateChangedMessage =>
      event.type === "workflow.state.changed"
  );
}

describe("workflow engine", () => {
  it("treats only blocked and failed as terminal phases", () => {
    expect(isTerminalPhase("blocked")).toBe(true);
    expect(isTerminalPhase("failed")).toBe(true);
    expect(isTerminalPhase("awaiting-signature")).toBe(false);
  });

  it("advances to awaiting-signature for a happy path", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1");
    engine.handleParsedIntent("req-1", validIntent);
    engine.handleRiskReport("req-1", happyRisk);
    engine.handleActionReady("req-1", "action-1");
    engine.handlePreviewReady("req-1");

    expect(engine.getState("req-1")?.phase).toBe("awaiting-signature");
  });

  it("ignores stale events once awaiting-signature is reached", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1b");
    engine.handleParsedIntent("req-1b", validIntent);
    engine.handleRiskReport("req-1b", happyRisk);
    engine.handleActionReady("req-1b", "action-1");
    engine.handleSimulationReady("req-1b");

    engine.handleRiskReport("req-1b", {
      source: "policy-fallback",
      score: 5,
      level: "high",
      blocking: true,
      checks: [
        {
          key: "late-risk-result",
          label: "Late Risk Result",
          status: "fail",
          detail: "Late risk result still indicates blocking risk"
        }
      ],
      summary: "Late risk result"
    });
    engine.handleActionReady("req-1b", "action-1");
    engine.handleSimulationReady("req-1b");
    engine.handleFailure("req-1b", "simulation-failed");

    expect(engine.getState("req-1b")?.phase).toBe("awaiting-signature");
  });

  it("advances from awaiting-signature to confirmed through submission events", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1c");
    engine.handleParsedIntent("req-1c", validIntent);
    engine.handleRiskReport("req-1c", happyRisk);
    engine.handleActionReady("req-1c", "action-1");
    engine.handlePreviewReady("req-1c");
    engine.handleExecutionConfirmed("req-1c");
    engine.handleTransactionSubmitted("req-1c");
    engine.handleTransactionSettled("req-1c");

    expect(engine.getState("req-1c")?.phase).toBe("confirmed");
    expect(engine.getState("req-1c")?.reason).toBe("confirmed");
  });

  it("returns to idle when signature is cancelled", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1d");
    engine.handleParsedIntent("req-1d", validIntent);
    engine.handleRiskReport("req-1d", happyRisk);
    engine.handleActionReady("req-1d", "action-1");
    engine.handlePreviewReady("req-1d");
    engine.handleExecutionCancelled("req-1d");

    expect(engine.getState("req-1d")?.phase).toBe("idle");
    expect(engine.getState("req-1d")?.reason).toBe("signature-cancelled");
  });

  it("moves to failed when submission fails", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-1e");
    engine.handleParsedIntent("req-1e", validIntent);
    engine.handleRiskReport("req-1e", happyRisk);
    engine.handleActionReady("req-1e", "action-1");
    engine.handlePreviewReady("req-1e");
    engine.handleExecutionConfirmed("req-1e");
    engine.handleSubmitFailed("req-1e");

    expect(engine.getState("req-1e")?.phase).toBe("failed");
    expect(engine.getState("req-1e")?.reason).toBe("submit-failed");
  });

  it("returns to idle when an empty actions intent is parsed", () => {
    const engine = createWorkflowEngine();

    engine.start("req-0");
    engine.handleParsedIntent("req-0", {
      ...validIntent,
      actions: []
    });

    expect(engine.getState("req-0")?.phase).toBe("idle");
    expect(engine.getState("req-0")?.reason).toBe("intent-invalid");
  });

  it("returns to idle when clarification is required", () => {
    const engine = createWorkflowEngine();

    engine.start("req-2");
    engine.handleParsedIntent("req-2", {
      ...validIntent,
      metadata: {
        ...validIntent.metadata,
        needsClarification: true
      }
    });

    expect(engine.getState("req-2")?.phase).toBe("idle");
    expect(engine.getState("req-2")?.reason).toBe("clarification-required");
  });

  it("moves to quoting when risk scan is not required", () => {
    const engine = createWorkflowEngine();

    engine.start("req-2b");
    engine.handleParsedIntent("req-2b", {
      ...validIntent,
      metadata: {
        ...validIntent.metadata,
        requiresRiskScan: false
      }
    });

    expect(engine.getState("req-2b")?.phase).toBe("quoting");
  });

  it("continues to quoting when risk is high and requires user confirmation later", () => {
    const engine = createWorkflowEngine();
    const highRisk: SecurityReport = {
      source: "policy-fallback",
      score: 10,
      level: "high",
      blocking: true,
      checks: [
        {
          key: "mint-authority",
          label: "Mint Authority",
          status: "fail",
          detail: "Mint authority is present"
        }
      ],
      summary: "Mint authority present"
    };

    engine.start("req-3");
    engine.handleParsedIntent("req-3", validIntent);
    engine.handleRiskReport("req-3", highRisk);

    expect(engine.getState("req-3")?.phase).toBe("quoting");
    expect(engine.getState("req-3")?.reason).toBeUndefined();
  });

  it("moves to failed when simulation fails during preview generation", () => {
    const engine = createWorkflowEngine();
    const happyRisk: SecurityReport = {
      source: "policy-fallback",
      score: 90,
      level: "low",
      blocking: false,
      checks: [],
      summary: "Safe enough for demo"
    };

    engine.start("req-4");
    engine.handleParsedIntent("req-4", validIntent);
    engine.handleRiskReport("req-4", happyRisk);
    engine.handleActionReady("req-4", "action-1");
    // Fail during simulating phase, before reaching awaiting-signature
    engine.handleFailure("req-4", "simulation-failed");

    expect(engine.getState("req-4")?.phase).toBe("failed");
    expect(engine.getState("req-4")?.reason).toBe("simulation-failed");
  });

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

    // Check for sequence: parse, risk, quote/action, preview
    expect(events.some((e) => e.type === "intent.parse.succeeded")).toBe(true);
    expect(events.some((e) => e.type === "risk.scan.completed")).toBe(true);
    expect(events.some((e) => e.type === "execution.preview.ready")).toBe(true);
  });

  it("uses the default runtime services when none are injected", async () => {
    const router = createMessageRouter();
    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-default-services",
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

    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(
      true
    );
  });

  it("passes contextSnapshot through the parser boundary", async () => {
    const parseIntent = vi.fn().mockResolvedValue(validIntent);
    const router = createMessageRouter(undefined, {
      parseIntent,
      scanRisk: createMockRiskAdapter().scanRisk,
      buildPreview: createMockPreviewAdapter().buildPreview,
      getOrder: createMockQuoteAdapter().getOrder,
      simulateBundle: vi.fn().mockResolvedValue({})
    });
    const contextSnapshot = {
      tabId: 2,
      url: "https://x.com/some-post",
      title: "A post on X",
      selectedText: "buy this token",
      detectedTokens: [
        {
          symbol: "BONK",
          source: "twitter" as const,
          confidence: 0.82
        }
      ],
      rawHints: ["buy", "bonk", "jupiter"],
      detectedAt: "2026-04-19T00:00:00.000Z"
    };

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-context-pass",
        tabId: 2,
        userInput: "buy 1 SOL of this",
        contextSnapshot
      }
    });

    expect(parseIntent).toHaveBeenCalledWith("buy 1 SOL of this", contextSnapshot);
  });

  it("keeps the default risk adapter on the mock path", async () => {
    const adapter = createMockRiskAdapter();
    const report = await adapter.scanRisk(validIntent);

    expect(report.level).toBe("low");
    expect(report.blocking).toBe(false);
  });

  it("uses the policy preview adapter to combine quote and simulation results", async () => {
    const adapter = createPolicyPreviewAdapter({
      quoteAdapter: createMockQuoteAdapter(),
      simulationAdapter: {
        simulate: vi.fn().mockResolvedValue({
          simulationSummary: "Mock simulation ready",
          success: true
        })
      }
    });
    const preview = await adapter.buildPreview("req-policy-preview", validIntent);

    expect(preview.requestId).toBe("req-policy-preview");
    expect(preview.routeLabel).toBe("Jupiter");
    expect(preview.simulationSummary).toBe("Mock simulation ready");
  });

  it("moves from awaiting-signature to confirmed through router submission events", async () => {
    const router = createMessageRouter();

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-submit",
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

    const executionConfirmed = await router.handleExecutionConfirmed({
      type: "execution.confirmed",
      payload: {
        requestId: "req-submit"
      }
    } satisfies ExecutionConfirmedMessage);
    const transactionSubmitted = router.handleTransactionSubmitted({
      type: "transaction.submitted",
      payload: {
        requestId: "req-submit",
        signature: "sig-123"
      }
    } satisfies TransactionSubmittedMessage);
    const transactionSettled = router.handleTransactionSettled({
      type: "transaction.settled",
      payload: {
        requestId: "req-submit",
        signature: "sig-123",
        settledAt: "2026-04-18T00:00:01.000Z"
      }
    } satisfies TransactionSettledMessage);

    const stateChange = getWorkflowStates(executionConfirmed).find((e) => e.payload.requestId === "req-submit");
    expect(stateChange?.payload).toMatchObject({
      requestId: "req-submit",
      phase: "submitting"
    });
    expect(getWorkflowStates(transactionSubmitted).at(-1)?.payload).toMatchObject({
      requestId: "req-submit",
      phase: "submitting"
    });
    expect(getWorkflowStates(transactionSettled).at(-1)?.payload).toMatchObject({
      requestId: "req-submit",
      phase: "confirmed",
      reason: "confirmed"
    });
  });

  it("moves back to idle when the router receives a signature cancellation", async () => {
    const router = createMessageRouter();

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-cancel",
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

    const cancelled = router.handleExecutionCancelled({
      type: "execution.cancelled",
      payload: {
        requestId: "req-cancel"
      }
    } satisfies ExecutionCancelledMessage);

    expect(getWorkflowStates(cancelled).at(-1)?.payload).toMatchObject({
      requestId: "req-cancel",
      phase: "idle",
      reason: "signature-cancelled"
    });
  });

  it("moves to failed when the router receives a submit failure", async () => {
    const router = createMessageRouter();

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-submit-fail",
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
    router.handleExecutionConfirmed({
      type: "execution.confirmed",
      payload: {
        requestId: "req-submit-fail"
      }
    } satisfies ExecutionConfirmedMessage);

    const failed = router.handleTransactionFailed({
      type: "transaction.failed",
      payload: {
        requestId: "req-submit-fail",
        reason: "RPC rejected"
      }
    } satisfies TransactionFailedMessage);

    expect(getWorkflowStates(failed).at(-1)?.payload).toMatchObject({
      requestId: "req-submit-fail",
      phase: "failed",
      reason: "submit-failed"
    });
  });

  it("emits parse failure and failed state for malformed intent input", async () => {
    const engine = createWorkflowEngine();
    const router = createMessageRouter(engine);

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-parse-fail",
        tabId: 1,
        userInput: "parse-fail",
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

    expect(events.map((event) => event.type)).toEqual([
      "workflow.state.changed",
      "intent.parse.failed",
      "workflow.state.changed"
    ]);
    expect(events[1]).toMatchObject({
      type: "intent.parse.failed",
      payload: {
        requestId: "req-parse-fail",
        reason: "Intent parse failed",
        recoverable: false
      }
    } satisfies IntentParseFailedMessage);
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-parse-fail",
      phase: "failed",
      reason: "intent-invalid"
    });
  });

  it("emits risk scan failure and failed state for risk-fail input", async () => {
    const router = createMessageRouter(undefined, {
      parseIntent: createMockIntentParser().parseIntent,
      scanRisk: createMockRiskAdapter().scanRisk,
      buildPreview: createMockPreviewAdapter().buildPreview,
      getOrder: createMockQuoteAdapter().getOrder,
      simulateBundle: vi.fn().mockResolvedValue({})
    });

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-risk-fail",
        tabId: 1,
        userInput: "risk-fail",
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

    expect(events.map((event) => event.type)).toEqual([
      "workflow.state.changed",
      "intent.parse.succeeded",
      "workflow.state.changed",
      "risk.scan.requested",
      "workflow.state.changed"
    ]);
    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(
      false
    );
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-risk-fail",
      phase: "failed",
      reason: "risk-check-failed"
    });
  });

  it("short-circuits clarification without risk or preview work", async () => {
    const router = createMessageRouter();

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-clarify",
        tabId: 1,
        userInput: "unclear",
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

    expect(events.some((event) => event.type === "risk.scan.requested")).toBe(
      false
    );
    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(
      false
    );
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-clarify",
      phase: "idle",
      reason: "clarification-required"
    });
  });

  it("keeps processing when parser-side normalization does not request clarification", async () => {
    const parseIntent = vi.fn(async (userInput: string) =>
      normalizeIntentWithContext(
        {
          ...validIntent,
          metadata: {
            ...validIntent.metadata,
            needsClarification: false,
            sourceContext: []
          }
        },
        {
          tabId: 1,
          url: "https://x.com/post",
          title: "X post",
          detectedTokens: [
            {
              symbol: "BONK",
              source: "twitter",
              confidence: 0.82
            },
            {
              symbol: "WIF",
              source: "twitter",
              confidence: 0.81
            }
          ],
          rawHints: ["buy", "bonk", "wif"],
          detectedAt: "2026-04-19T00:00:00.000Z"
        },
        userInput
      )
    );
    const scanRisk = vi.fn(createMockRiskAdapter().scanRisk);
    const buildPreview = vi.fn(createMockPreviewAdapter().buildPreview);
    const router = createMessageRouter(undefined, {
      parseIntent,
      scanRisk,
      buildPreview,
      getOrder: createMockQuoteAdapter().getOrder,
      simulateBundle: vi.fn().mockResolvedValue({})
    });

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-context-clarify",
        tabId: 1,
        userInput: "buy BONK",
        contextSnapshot: {
          tabId: 1,
          url: "https://x.com/post",
          title: "X post",
          detectedTokens: [],
          rawHints: [],
          detectedAt: "2026-04-19T00:00:00.000Z"
        }
      }
    });

    expect(scanRisk).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(true);
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-context-clarify",
      phase: "awaiting-signature"
    });
  });

  it("keeps processing when weak page evidence does not produce clarification metadata", async () => {
    const parseIntent = vi.fn(async (userInput: string) =>
      normalizeIntentWithContext(
        {
          ...validIntent,
          metadata: {
            ...validIntent.metadata,
            needsClarification: false,
            sourceContext: []
          }
        },
        {
          tabId: 1,
          url: "https://example.com/post",
          title: "Token thread",
          detectedTokens: [],
          rawHints: ["moon", "buy"],
          detectedAt: "2026-04-19T00:00:00.000Z"
        },
        userInput
      )
    );
    const scanRisk = vi.fn(createMockRiskAdapter().scanRisk);
    const buildPreview = vi.fn(createMockPreviewAdapter().buildPreview);
    const router = createMessageRouter(undefined, {
      parseIntent,
      scanRisk,
      buildPreview,
      getOrder: createMockQuoteAdapter().getOrder,
      simulateBundle: vi.fn().mockResolvedValue({})
    });

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-mint-guardrail",
        tabId: 1,
        userInput: "buy some tokens",
        contextSnapshot: {
          tabId: 1,
          url: "https://example.com/post",
          title: "Token thread",
          detectedTokens: [],
          rawHints: ["moon", "buy"],
          detectedAt: "2026-04-19T00:00:00.000Z"
        }
      }
    });

    expect(scanRisk).toHaveBeenCalledTimes(1);
    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(true);
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-mint-guardrail",
      phase: "awaiting-signature"
    });
  });

  it("continues to preview when risk scan returns high risk", async () => {
    const emitted: SIPRuntimeMessage[] = [];
    const router = createMessageRouter(undefined, {
      ...createMockRuntimeServices(),
      scanRisk: vi.fn().mockResolvedValue({
        source: "policy-fallback",
        score: 10,
        level: "high",
        blocking: true,
        checks: [
          {
            key: "mint-authority",
            label: "Mint Authority",
            status: "fail",
            detail: "Mint authority is present"
          }
        ],
        summary: "High risk detected"
      } satisfies SecurityReport)
    }, (event) => emitted.push(event));

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-blocked",
        tabId: 1,
        userInput: "blocked",
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

    expect(emitted.some((event) => event.type === "execution.preview.ready")).toBe(true);
    expect(emitted.some((event) => event.type === "risk.scan.completed")).toBe(
      true
    );
    expect(getWorkflowStates(emitted).at(-1)?.payload).toMatchObject({
      requestId: "req-blocked",
      phase: "awaiting-signature"
    });
  });

  it("emits a failed state when preview generation fails", async () => {
    const router = createMessageRouter(undefined, {
      ...createMockRuntimeServices(),
      buildPreview: vi.fn().mockRejectedValue(new Error("simulation-failed"))
    });

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-preview-fail",
        tabId: 1,
        userInput: "preview-fail",
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

    expect(events.some((event) => event.type === "execution.preview.failed")).toBe(
      true
    );
    expect(getWorkflowStates(events).at(-1)?.payload).toMatchObject({
      requestId: "req-preview-fail",
      phase: "failed",
      reason: "simulation-failed"
    });
  });
});
