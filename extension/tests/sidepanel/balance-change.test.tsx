import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { ActionCard } from "../../src/sidepanel/components/ActionCard";

const preview = {
  requestId: "req-1",
  routeLabel: "Jupiter",
  inputAmount: "1000000000", // 1 SOL
  outputAmount: "100000000", // 100 USDC (6 decimals)
  slippageBps: 50,
  estimatedFeeLamports: "5000",
  simulationSummary: "Simulated OK",
  swapTransaction: ""
};

const intent = {
    intentId: "intent-1",
    mode: "SINGLE",
    actions: [{
        id: "action-1",
        type: "SWAP",
        status: "ready",
        payload: {
            inputSymbol: "SOL",
            outputSymbol: "USDC",
            inputDecimals: 9,
            outputDecimals: 6
        }
    }],
    metadata: {
        strategyGoal: "buy USDC",
        reasoning: "User wants USDC",
        jitoTipLamports: 0,
        requiresRiskScan: true,
        sourceContext: [],
        needsClarification: false
    }
} as any;

describe("ActionCard Balance Change", () => {
    it("renders the balance change area with correct colors and symbols", () => {
        const html = renderToString(
            <ActionCard
                preview={preview as any}
                intent={intent}
                phase="awaiting-signature"
                reason={null}
                walletStatus="ready"
                isSigning={false}
                onConfirm={() => {}}
                onCancel={() => {}}
                onOpenNormalPage={() => {}}
                onRetry={() => {}}
                onFailSubmit={() => {}}
                onSettle={() => {}}
            />
        );

        // Check for formatted amounts and symbols
        expect(html).toContain("1 SOL");
        expect(html).toContain("100 USDC");
        
        // Check for arrow
        expect(html).toContain("➔");

        // Check for Solana Purple (#9945FF) and Solana Green (#14F195)
        // Using toLowerCase() to be safe with hex codes
        expect(html.toLowerCase()).toContain("9945ff");
        expect(html.toLowerCase()).toContain("14f195");
    });
});
