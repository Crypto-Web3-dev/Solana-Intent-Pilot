import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/background/wasm-risk-engine", () => ({
  loadDefaultWasmRiskEngine: vi.fn().mockResolvedValue(null)
}));

import { createRequestTracker } from "../../src/sidepanel/hooks/useSidePanelState";
import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve(__dirname, "../../src/sidepanel/pages/SidePanelPage.tsx");
const sourceCode = fs.readFileSync(sourcePath, "utf-8");

describe("SidePanelPage", () => {
  it("exposes the updated supported-page badge copy via source", () => {
    expect(sourceCode).toContain("Supported Page Required");
    expect(sourceCode).toContain("Open a supported page like Jupiter, pump.fun, X, DexScreener, Solscan, or Raydium before submitting.");
  });

  it("treats only the latest submit request as current", () => {
    const tracker = createRequestTracker();
    const first = tracker.next();
    const second = tracker.next();

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });
});
