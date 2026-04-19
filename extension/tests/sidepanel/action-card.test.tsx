import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ActionCard } from "../../src/sidepanel/components/ActionCard";

describe("ActionCard", () => {
  it("shows clarification details when the parser requests more specificity", () => {
    const html = renderToString(
      <ActionCard
        preview={null}
        phase="idle"
        reason="clarification-required"
        clarification={{
          kind: "ambiguous-output-mint",
          message: "I found multiple possible token candidates.",
          candidateSymbols: ["BONK", "WIF"]
        }}
        walletStatus="unknown"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onFailSubmit={() => {}}
        onSettle={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Clarification needed");
    expect(html).toContain("I found multiple possible token candidates.");
    expect(html).toContain("BONK, WIF");
  });

  it("shows a wallet-missing hint while waiting for signature", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000"
        }}
        phase="awaiting-signature"
        reason={null}
        clarification={null}
        walletStatus="provider-missing"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onFailSubmit={() => {}}
        onSettle={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("No Solana wallet was detected on the current page.");
    expect(html).toContain("Confirm Signature");
    expect(html).toContain("Preview is ready. Waiting for wallet confirmation.");
  });

  it("shows an in-progress wallet message while signing", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000"
        }}
        phase="awaiting-signature"
        reason={null}
        clarification={null}
        walletStatus="connecting"
        isSigning={true}
        onConfirm={() => {}}
        onCancel={() => {}}
        onFailSubmit={() => {}}
        onSettle={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Waiting for your wallet to respond.");
    expect(html).toContain("Confirming...");
  });

  it("shows submitted status while waiting for confirmation", () => {
    const html = renderToString(
      <ActionCard
        preview={null}
        phase="submitting"
        reason={null}
        clarification={null}
        walletStatus="submitted"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onFailSubmit={() => {}}
        onSettle={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain(
      "Transaction submitted. Waiting for chain confirmation."
    );
  });
});
