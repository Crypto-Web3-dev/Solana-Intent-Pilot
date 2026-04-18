import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SidePanelPage } from "../../src/sidepanel/pages/SidePanelPage";

describe("SidePanelPage", () => {
  it("renders a mock workflow summary", () => {
    const html = renderToString(<SidePanelPage />);
    expect(html).toContain("SIP Side Panel");
    expect(html).toContain("Submit Mock Intent");
    expect(html).toContain("Workflow: ");
    expect(html).toContain("Reason:");
    expect(html).toContain("none");
  });
});
