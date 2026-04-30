import { describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

import { useSidePanelState, createRequestTracker } from "../../src/sidepanel/hooks/useSidePanelState";
import { createMessageRouter } from "../../src/background/message-router";
import type { WorkflowStateChangedMessage } from "../../src/shared/messages";

// Mock dependencies
vi.mock("../wallet-bridge", () => ({
  detectWalletStatus: vi.fn().mockResolvedValue("connected"),
  submitWithLifecycle: vi.fn()
}));

vi.mock("../page-context", () => ({
  getCurrentPageContext: vi.fn().mockResolvedValue({ tabId: 1, url: "https://jup.ag" })
}));

describe("useSidePanelState logic", () => {
  it("can be initialized with a mock router", () => {
    const events: any[] = [];
    const mockRouter = createMessageRouter(undefined, undefined, (e) => events.push(e));

    mockRouter.handleExecutionCancelled({
      type: "execution.cancelled",
      payload: { requestId: "test" }
    });

    const message = events.find(e => e.type === "workflow.state.changed") as WorkflowStateChangedMessage;
    expect(message).toBeDefined();
    expect(message.payload.requestId).toBe("test");
  });

  it("verifies that createRequestTracker works correctly", () => {
      const tracker = createRequestTracker();
      const first = tracker.next();
      const second = tracker.next();
      expect(tracker.isCurrent(first)).toBe(false);
      expect(tracker.isCurrent(second)).toBe(true);
  });
});
