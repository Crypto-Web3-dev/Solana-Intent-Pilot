import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SidePanelPage } from "../../src/sidepanel/pages/SidePanelPage";
import { createRequestTracker } from "../../src/sidepanel/hooks/useSidePanelState";

describe("SidePanelPage", () => {
  it("renders a mock workflow summary", () => {
    const html = renderToString(<SidePanelPage />);
    expect(html).toContain("SIP Side Panel");
    expect(html).toContain("Submit Intent");
    expect(html).toContain("Workflow State");
    expect(html).toContain("Intent + Risk");
    expect(html).toContain("Execution");
    expect(html).toContain("Demo-ready workflow panel");
    expect(html).toContain("none");
  });

  it("treats only the latest submit request as current", () => {
    const tracker = createRequestTracker();
    const first = tracker.next();
    const second = tracker.next();

    expect(tracker.isCurrent(first)).toBe(false);
    expect(tracker.isCurrent(second)).toBe(true);
  });
});
