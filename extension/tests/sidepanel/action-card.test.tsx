import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ActionCard } from "../../src/sidepanel/components/ActionCard";
import type { SecurityReport } from "../../src/shared/risk";

const preview = {
  requestId: "req-1",
  routeLabel: "Jupiter",
  inputAmount: "1 SOL",
  outputAmount: "100 USDC",
  slippageBps: 50,
  estimatedFeeLamports: "5000",
  simulationSummary: "Simulated OK",
  swapTransaction: ""
};

function risk(level: SecurityReport["level"], score: number): SecurityReport {
  return {
    source: "wasm",
    score,
    level,
    blocking: false,
    checks: [],
    summary: `${level} risk`
  };
}

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

    expect(html).toContain("Execution Paused");
    expect(html).toContain("Network error");
    expect(html).toContain("Reset &amp; Try Again");
  });

  it("shows preview details when preview is ready", () => {
    const html = renderToString(
      <ActionCard
        preview={preview}
        risk={risk("low", 92)}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Proposed Execution");
    expect(html).toContain("Direct Swap");
    expect(html).toContain("Est. Impact");
    expect(html).toContain("Estimated Network Fee");
    expect(html).toContain("Simulated OK");
    expect(html).toContain("Confirm &amp; Continue");
    expect(html).toContain("Cancel");
  });

  it("shows signing message when isSigning is true", () => {
    const html = renderToString(
      <ActionCard
        preview={preview}
        risk={risk("low", 92)}
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
        risk={risk("medium", 65)}
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
    expect(html).toContain("Verification Failed");
    expect(html).toContain("disabled");
  });

  it("shows distinct low risk confirmation copy", () => {
    const html = renderToString(
      <ActionCard
        preview={preview}
        risk={risk("low", 92)}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Low risk checks passed");
    expect(html).toContain("Confirm &amp; Continue");
  });

  it("shows distinct medium risk confirmation copy", () => {
    const html = renderToString(
      <ActionCard
        preview={preview}
        risk={risk("medium", 65)}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("Medium risk warning");
    expect(html).toContain("Review Risk &amp; Continue");
  });

  it("shows distinct high risk confirmation copy without disabling confirm", () => {
    const html = renderToString(
      <ActionCard
        preview={preview}
        risk={risk("high", 30)}
        phase="awaiting-signature"
        reason={null}
        walletStatus="ready"
        isSigning={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        onOpenNormalPage={() => {}}
      />
    );

    expect(html).toContain("High risk warning");
    expect(html).toContain("Confirm High Risk &amp; Continue");
    expect(html).not.toContain("disabled");
  });
});
