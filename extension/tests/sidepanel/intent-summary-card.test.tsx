import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { IntentSummaryCard } from "../../src/sidepanel/components/IntentSummaryCard";
import type { SIPIntent } from "../../src/shared/intent";

const verifiedIntent: SIPIntent = {
  intentId: "intent-1",
  mode: "SINGLE",
  actions: [
    {
      id: "action-1",
      type: "SWAP",
      status: "pending",
      payload: {
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
        amount: "1000000000",
        amountMode: "exact",
        platform: "Jupiter",
        inputSymbol: "SOL",
        outputSymbol: "PUMP",
        outputTokenName: "Pump",
        outputTokenVerified: true,
        outputTokenVerificationSource: "jupiter",
        outputDecimals: 6,
        slippageBps: 50
      }
    }
  ],
  metadata: {
    strategyGoal: "Swap SOL to PUMP",
    reasoning: "Executing a decentralized exchange swap.",
    jitoTipLamports: 0,
    requiresRiskScan: true,
    sourceContext: ["user-input", "detected-token"],
    needsClarification: false
  }
};

describe("IntentSummaryCard", () => {
  it("shows verified context token details when the parsed intent used one", () => {
    const html = renderToString(
      <IntentSummaryCard intent={verifiedIntent} phase="awaiting-signature" />
    );

    expect(html).toContain("Context Token Verified");
    expect(html).toContain("PUMP");
    expect(html).toContain("Pump");
    expect(html).toContain("Jupiter Tokens");
    expect(html).toContain("pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn");
  });
});
