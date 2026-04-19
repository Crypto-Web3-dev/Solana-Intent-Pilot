import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RiskIndicator } from "../../src/sidepanel/components/RiskIndicator";

describe("RiskIndicator", () => {
  it("renders unknown risk as incomplete data", () => {
    const html = renderToString(
      <RiskIndicator
        risk={{
          source: "policy-fallback",
          score: 0,
          level: "unknown",
          blocking: false,
          checks: [],
          summary: "Insufficient data"
        }}
        phase="idle"
      />
    );

    expect(html).toContain("Risk: unknown - data is incomplete");
    expect(html).toContain("Risk source:");
    expect(html).toContain("policy fallback");
  });
});
