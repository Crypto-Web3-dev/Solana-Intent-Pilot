import { describe, expect, it, vi } from "vitest";
import { createRequestTracker } from "../../src/sidepanel/hooks/useSidePanelState";
import { createMessageRouter } from "../../src/background/message-router";
import type { WorkflowStateChangedMessage } from "../../src/shared/messages";
import fs from "node:fs";
import path from "node:path";

vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

const sourcePath = path.resolve(__dirname, "../../src/sidepanel/hooks/useSidePanelState.ts");
const sourceCode = fs.readFileSync(sourcePath, "utf-8");

describe("useSidePanelState logic", () => {
  it("can be initialized with a mock router", () => {
    const events: any[] = [];
    const mockRouter = createMessageRouter(undefined, undefined, (event) => events.push(event));

    mockRouter.handleExecutionCancelled({
      type: "execution.cancelled",
      payload: { requestId: "test" }
    });

    const message = events.find(
      (event) => event.type === "workflow.state.changed"
    ) as WorkflowStateChangedMessage;

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

  it("uses supported-page copy in the blocked flow", () => {
    expect(sourceCode).toContain("SUPPORTED_PAGE_MESSAGE");
    expect(sourceCode).toContain("Open a supported page like Jupiter, pump.fun, X, DexScreener, Solscan, or Raydium before submitting.");
    expect(sourceCode).toContain("https://jup.ag");
  });
});
