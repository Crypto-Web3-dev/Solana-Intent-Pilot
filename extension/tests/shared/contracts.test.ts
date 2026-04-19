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
        needsClarification: false,
        clarification: {
          kind: "ambiguous-output-mint",
          message: "Multiple token candidates were detected.",
          candidateSymbols: ["BONK", "WIF"]
        }
      }
    };

    expect(intent.intent).toBe("SWAP");
  });

  it("supports unknown risk level without creating a workflow phase", () => {
    const report: SecurityReport = {
      source: "policy-fallback",
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
