import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ActionCard } from "../../src/sidepanel/components/ActionCard";

describe("ActionCard", () => {
  it("shows success message when phase is confirmed", () => {
    const html = renderToString(
      <ActionCard
        preview={null}
        phase="confirmed"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Transaction Complete");
  });

  it("shows error message when phase is failed", () => {
    const html = renderToString(
      <ActionCard
        preview={null}
        phase="failed"
        reason="Network error"
        walletStatus="failed"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Execution Failed");
    expect(html).toContain("Network error");
    expect(html).toContain("Try Again");
  });

  it("shows preview details when preview is ready", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000",
          simulationSummary: "Simulated OK",
          swapTransaction: ""
        }}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Execution Preview");
    expect(html).toContain("Strategy");
    expect(html).toContain("Min Received");
    expect(html).toContain("Est. Jito Tip");
    expect(html).toContain("Simulated OK");
    expect(html).toContain("Execute Atomic Bundle");
    expect(html).toContain("Cancel");
  });

  it("shows signing message when isSigning is true", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000",
          simulationSummary: "Simulated OK",
          swapTransaction: ""
        }}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={true}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Signing...");
    expect(html).toContain("disabled");
  });

  it("shows degraded preview warning and disables confirm", () => {
    const html = renderToString(
      <ActionCard
        preview={{
          requestId: "req-1",
          routeLabel: "Jupiter",
          inputAmount: "1 SOL",
          outputAmount: "100 USDC",
          slippageBps: 50,
          estimatedFeeLamports: "5000",
          simulationSummary: "Live simulation failed. Falling back to a degraded preview path.",
          swapTransaction: ""
        }}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("degraded state");
    expect(html).toContain("Preview Degraded");
    expect(html).toContain("disabled");
  });
});
