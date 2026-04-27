import { describe, expect, it } from "vitest";
import {
  applyTokenConfirmation,
  formatClarificationChoiceSummary
} from "../../src/sidepanel/token-confirmation";

describe("token confirmation helpers", () => {
  it("replaces this with the selected token symbol", () => {
    expect(applyTokenConfirmation("buy 1 SOL of this", "RAVE")).toBe(
      "buy 1 SOL of RAVE"
    );
  });

  it("rewrites an ambiguous token choice into the selected mint", () => {
    expect(
      applyTokenConfirmation(
        "buy 1 SOL of USD1",
        "USD1 | World Liberty Financial USD | USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB"
      )
    ).toBe(
      "buy 1 SOL of USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB"
    );
  });

  it("formats a confirmed ambiguous token choice for low-profile display", () => {
    expect(
      formatClarificationChoiceSummary(
        "USD1 | World Liberty Financial USD | USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB"
      )
    ).toBe(
      "USD1 · World Liberty Financial USD · USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB"
    );
  });
});
