import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";

// Mock WASM dependency to avoid ESM integration errors in Vitest
vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

import { SidePanelPage } from "../../src/sidepanel/pages/SidePanelPage";
import { createRequestTracker } from "../../src/sidepanel/hooks/useSidePanelState";

describe("SidePanelPage", () => {
  it("renders a mock workflow summary", () => {
    const html = renderToString(<SidePanelPage />);
    expect(html).toContain("SIP Assistant");
    expect(html).toContain("Submit Intent");
    expect(html).toContain("Your Request");
  });

  it("treats only the latest submit request as current", () => {
    const tracker = createRequestTracker();
    const first = tracker.next();
    const second = tracker.next();

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });
});
