import { useState } from "react";
import { ActionCard } from "../components/ActionCard";
import { DetectionBar } from "../components/DetectionBar";
import { IntentSummaryCard } from "../components/IntentSummaryCard";
import { RiskIndicator } from "../components/RiskIndicator";
import { useSidePanelState } from "../hooks/useSidePanelState";

const panelStyles = {
  shell: {
    minHeight: "100vh",
    padding: 16,
    background:
      "radial-gradient(circle at top, #1e293b 0%, #0f172a 45%, #020617 100%)",
    color: "#e2e8f0",
    fontFamily: "Inter, system-ui, sans-serif"
  },
  card: {
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: 16,
    background: "rgba(15, 23, 42, 0.72)",
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
    padding: 16,
    marginTop: 16,
    backdropFilter: "blur(12px)"
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "#94a3b8",
    marginBottom: 8
  },
  input: {
    display: "block",
    width: "100%",
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#111827",
    color: "#e2e8f0"
  },
  button: {
    border: 0,
    borderRadius: 10,
    padding: "10px 14px",
    background: "#38bdf8",
    color: "#082f49",
    fontWeight: 700,
    cursor: "pointer" as const
  }
};

export function SidePanelPage() {
  const [input, setInput] = useState("buy 1 SOL of this");
  const state = useSidePanelState();

  return (
    <main style={panelStyles.shell}>
      <header>
        <div style={panelStyles.label}>SIP Extension</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>SIP Side Panel</h1>
        <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
          Demo-ready workflow panel for intent parsing, risk checks, and execution preview.
        </p>
      </header>

      <section style={panelStyles.card}>
        <div style={panelStyles.label}>Request</div>
        <DetectionBar phase={state.phase} />
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          style={panelStyles.input}
        />
        <button onClick={() => void state.submit(input)} style={panelStyles.button}>
          Submit Mock Intent
        </button>
      </section>

      <section style={panelStyles.card}>
        <div style={panelStyles.label}>Workflow State</div>
        <div>Request: {state.requestId ?? "none"}</div>
        <div>Phase: {state.phase}</div>
        <div>Reason: {state.reason ?? "none"}</div>
        <div>Wallet: {state.walletStatus}</div>
        {state.errorMessage ? <div>Error: {state.errorMessage}</div> : null}
      </section>

      <section style={panelStyles.card}>
        <div style={panelStyles.label}>Intent + Risk</div>
        <IntentSummaryCard intent={state.intent} phase={state.phase} />
        <div style={{ height: 12 }} />
        <RiskIndicator risk={state.risk} phase={state.phase} />
      </section>

      <section style={panelStyles.card}>
        <div style={panelStyles.label}>Execution</div>
        <ActionCard
          preview={state.preview}
          phase={state.phase}
          reason={state.reason}
          clarification={state.clarification}
          walletStatus={state.walletStatus}
          isSigning={state.isSigning}
          onConfirm={state.confirmSignature}
          onCancel={state.cancelSignature}
          onFailSubmit={state.failSubmission}
          onSettle={state.settleTransaction}
          onOpenNormalPage={state.openNormalPage}
        />
      </section>
    </main>
  );
}
