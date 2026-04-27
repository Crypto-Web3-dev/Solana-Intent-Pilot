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
    const mockRouter = createMessageRouter();
    // We don't actually need to render to test the initial state
    const message = mockRouter.handleExecutionCancelled({
      type: "execution.cancelled",
      payload: { requestId: "test" }
    })[0] as WorkflowStateChangedMessage;
    const { requestId } = message.payload;
    expect(requestId).toBe("test");
  });

  it("verifies that createRequestTracker works correctly", () => {
      const tracker = createRequestTracker();
      const first = tracker.next();
      const second = tracker.next();
      expect(tracker.isCurrent(first)).toBe(false);
      expect(tracker.isCurrent(second)).toBe(true);
  });
});
