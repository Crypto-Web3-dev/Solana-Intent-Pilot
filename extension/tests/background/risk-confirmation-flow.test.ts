import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

import { createMessageRouter } from "../../src/background/message-router";
import { createMockRuntimeServices } from "../../src/background/runtime-services";
import { createWorkflowEngine } from "../../src/background/workflow-engine";
import type { SIPIntent } from "../../src/shared/intent";
import type { SIPRuntimeMessage } from "../../src/shared/messages";
import type { SecurityReport } from "../../src/shared/risk";

const validIntent: SIPIntent = {
  intentId: "risk-confirmation-intent",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      status: "pending",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "PumpMint1111111111111111111111111111111111",
        amount: "1000000000",
        amountMode: "exact",
        slippageBps: 50,
        platform: "Jupiter"
      }
    }
  ],
  mode: "SINGLE",
  metadata: {
    strategyGoal: "Swap SOL to a new token",
    reasoning: "User requested a swap",
    estimatedNetChange: { spend: "1 SOL", receive: "new token" },
    jitoTipLamports: 0,
    requiresRiskScan: true,
    sourceContext: [],
    needsClarification: false
  }
};

const highRisk: SecurityReport = {
  source: "wasm",
  score: 20,
  level: "high",
  blocking: false,
  checks: [
    {
      key: "fresh-token",
      label: "Fresh Token",
      status: "warn",
      detail: "Token appears to be very new"
    }
  ],
  summary: "High risk token"
};

describe("risk confirmation flow", () => {
  it("continues to quoting after a high risk report", () => {
    const engine = createWorkflowEngine();

    engine.start("req-risk");
    engine.handleParsedIntent("req-risk", validIntent);
    engine.handleRiskReport("req-risk", highRisk);

    expect(engine.getState("req-risk")?.phase).toBe("quoting");
    expect(engine.getState("req-risk")?.reason).toBeUndefined();
  });

  it("emits preview-ready instead of risk-blocked for high risk scans", async () => {
    const events: SIPRuntimeMessage[] = [];
    const services = createMockRuntimeServices();
    const router = createMessageRouter(
      createWorkflowEngine(),
      {
        ...services,
        parseIntent: vi.fn().mockResolvedValue(validIntent),
        scanRisk: vi.fn().mockResolvedValue(highRisk),
        getOrder: vi.fn().mockResolvedValue({
          quote: {},
          swapTransaction: "mock-transaction"
        }),
        simulateBundle: vi.fn().mockResolvedValue({
          success: true,
          summary: "Simulation ok"
        }),
        buildPreview: vi.fn().mockResolvedValue({
          requestId: "req-risk-router",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 NEW",
          slippageBps: 50,
          estimatedFeeLamports: "5000",
          simulationSummary: "Simulation ok",
          swapTransaction: "mock-transaction"
        })
      },
      (event) => events.push(event)
    );

    await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: "req-risk-router",
        tabId: 1,
        userInput: "buy 1 SOL of this",
        contextSnapshot: {
          tabId: 1,
          url: "https://pump.fun/coin/PumpMint1111111111111111111111111111111111",
          title: "New token",
          detectedTokens: [],
          rawHints: [],
          detectedAt: "2026-04-27T00:00:00.000Z"
        }
      }
    });

    expect(events.some((event) => event.type === "risk.scan.completed")).toBe(true);
    expect(events.some((event) => event.type === "execution.preview.ready")).toBe(true);
    expect(
      events.some(
        (event) =>
          event.type === "workflow.state.changed" &&
          event.payload.phase === "blocked" &&
          event.payload.reason === "risk-blocked"
      )
    ).toBe(false);
  });
});
