import { useState } from "react";
import { ActionCard } from "../components/ActionCard";
import { DetectionBar } from "../components/DetectionBar";
import { IntentSummaryCard } from "../components/IntentSummaryCard";
import { RiskIndicator } from "../components/RiskIndicator";
import { useSidePanelState } from "../hooks/useSidePanelState";
import {
  applyTokenConfirmation,
  formatClarificationChoiceSummary
} from "../token-confirmation";

const panelStyles = {
  shell: {
    minHeight: "100vh",
    padding: 20,
    background:
      "radial-gradient(circle at top, #1e293b 0%, #0f172a 45%, #020617 100%)",
    color: "#f8fafc",
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  card: {
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    background: "rgba(15, 23, 42, 0.6)",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4)",
    padding: 20,
    marginTop: 16,
    backdropFilter: "blur(16px)"
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "#64748b",
    marginBottom: 10
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 600,
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  },
  inputWrapper: {
    marginTop: 12,
    position: "relative" as const
  },
  input: {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(56, 189, 248, 0.2)",
    background: "rgba(15, 23, 42, 0.8)",
    color: "#f8fafc",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 0 0 2px rgba(56, 189, 248, 0.05)",
    transition: "all 0.2s ease"
  },
  button: {
    width: "100%",
    marginTop: 12,
    border: 0,
    borderRadius: 12,
    padding: "14px",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer" as const,
    transition: "all 0.2s ease"
  }
};

function getFriendlyError(errorMsg?: string | null) {
    if (!errorMsg) return "";
    const lower = errorMsg.toLowerCase();
    if (lower.includes("wallet public key") || lower.includes("connect your solana wallet")) return "Connect your Solana wallet before requesting a live Jupiter order.";
    if (lower.includes("user rejected")) return "Signature cancelled by user.";
    if (lower.includes("submit-failed")) return "Transaction failed to broadcast.";
    if (lower.includes("simulation-failed")) return "Execution simulation failed.";
    if (lower.includes("insufficient funds")) return "Insufficient balance for this trade.";
    return errorMsg.replace("Simulation Logic Failed:", "Failed:");
}

export function SidePanelPage() {
  const [input, setInput] = useState("buy 1 SOL of this");
  const [selectedClarificationChoice, setSelectedClarificationChoice] = useState<string | null>(null);
  const state = useSidePanelState();
  
  const isBusy = state.phase !== "idle" && 
                 state.phase !== "confirmed" && 
                 state.phase !== "failed" &&
                 state.phase !== "blocked";
                 
  const isIdle = state.phase === "idle";
  const effectiveInput = selectedClarificationChoice 
    ? applyTokenConfirmation(input, selectedClarificationChoice)
    : input;
  const selectedChoiceSummary = selectedClarificationChoice
    ? formatClarificationChoiceSummary(selectedClarificationChoice)
    : null;

  return (
    <main style={panelStyles.shell}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={panelStyles.label}>Solana Intent Pilot</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>SIP Assistant</h1>
          </div>
          <div style={{ 
            ...panelStyles.statusBadge, 
            color: state.walletStatus === "ready" ? "#10b981" : "#94a3b8" 
          }}>
            <div style={{ 
              width: 8, height: 8, borderRadius: "50%", 
              background: state.walletStatus === "ready" ? "#10b981" : "#64748b" 
            }} />
            {state.walletStatus === "ready" ? "Wallet Connected" : "Wallet Required"}
          </div>
        </div>
      </header>

      <section style={panelStyles.card}>
        <div style={panelStyles.label}>Your Request</div>
        <DetectionBar phase={state.phase} />
        <div style={panelStyles.inputWrapper}>
          <input
            value={input}
            disabled={isBusy}
            placeholder="What would you like to do on Solana?"
            onChange={(event) => {
                setInput(event.target.value);
                setSelectedClarificationChoice(null);
            }}
            style={{
                ...panelStyles.input,
                opacity: isBusy ? 0.6 : 1,
                borderColor: isBusy ? "rgba(255,255,255,0.05)" : "rgba(56, 189, 248, 0.2)"
            }}
          />
          {selectedChoiceSummary ? (
            <div style={{
                marginTop: 8,
                fontSize: 11,
                color: "#94a3b8",
                lineHeight: 1.4
            }}>
                Confirmed token: {selectedChoiceSummary}
            </div>
          ) : null}
          {isBusy ? (
            <button 
              onClick={() => state.cancelProcessing()} 
              style={{
                  ...panelStyles.button,
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  boxShadow: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px"
              }}
            >
              <div className="spin-slow" style={{ fontSize: 16 }}>🛑</div>
              Cancel Processing
            </button>
          ) : (
            <button 
              disabled={!input.trim()}
              onClick={() => void state.submit(effectiveInput)} 
              style={{
                  ...panelStyles.button,
                  background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                  color: "#082f49",
                  boxShadow: !input.trim() ? "none" : "0 4px 15px rgba(14, 165, 233, 0.3)",
                  cursor: !input.trim() ? "not-allowed" : "pointer",
                  opacity: !input.trim() ? 0.6 : 1
              }}
            >
              Submit Intent
            </button>
          )}
        </div>
        {isIdle && !state.intent && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", fontStyle: "italic" }}>
            Tip: Try "Swap 0.1 SOL to USDC" or "Stake some SOL"
          </div>
        )}
        {state.clarification?.candidateSymbols?.length ? (
            <div style={{ 
                marginTop: 14, 
                padding: 12, 
                borderRadius: 12, 
                border: "1px solid rgba(56, 189, 248, 0.14)",
                background: "rgba(56, 189, 248, 0.05)"
            }}>
                <div style={{ 
                    fontSize: 11, 
                    fontWeight: 700, 
                    textTransform: "uppercase", 
                    letterSpacing: "0.08em",
                    color: "#7dd3fc",
                    marginBottom: 8
                }}>
                    Confirm Output Token
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {state.clarification.candidateSymbols.map((symbol) => (
                        <button 
                            key={symbol}
                            onClick={() => {
                                const confirmedInput = applyTokenConfirmation(input, symbol);
                                setSelectedClarificationChoice(symbol.includes("|") ? symbol : null);
                                void state.submit(confirmedInput);
                            }}
                            style={{
                                border: "1px solid rgba(125, 211, 252, 0.24)",
                                background: "rgba(14, 165, 233, 0.1)",
                                color: "#e0f2fe",
                                borderRadius: 10,
                                padding: "8px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                opacity: 1
                            }}
                        >
                            {symbol.includes("|") ? symbol : `Confirm ${symbol}`}
                        </button>
                    ))}
                </div>
            </div>
        ) : null}
      </section>

      {state.errorMessage && (
        <div style={{ 
          marginTop: 16, padding: "12px 16px", borderRadius: 14, 
          background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)",
          color: "#f87171", fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: 16 }}>🚫</span>
          <div style={{ lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Pilot Warning</div>
            {getFriendlyError(state.errorMessage)}
          </div>
        </div>
      )}

      {(!isIdle || state.intent) && (
        <section style={panelStyles.card}>
          <div style={panelStyles.label}>Pilot Intelligence</div>
          <IntentSummaryCard intent={state.intent} phase={state.phase} preview={state.preview} />
          {state.risk && <div style={{ marginTop: 16 }}><RiskIndicator risk={state.risk} phase={state.phase} /></div>}
        </section>
      )}

      {(!isIdle || state.preview) && (
        <section style={panelStyles.card}>
          <div style={panelStyles.label}>Proposed Execution</div>
          <ActionCard
            preview={state.preview}
            intent={state.intent}
            risk={state.risk}
            phase={state.phase}
            reason={state.reason}
            clarification={state.clarification}
            walletStatus={state.walletStatus}
            isSigning={state.isSigning}
            onConfirm={state.confirmSignature}
            onRetry={state.retrySignature}
            onCancel={state.cancelSignature}
            onFailSubmit={state.failSubmission}
            onSettle={state.settleTransaction}
            onOpenNormalPage={state.openNormalPage}
          />
        </section>
      )}

      {isIdle && !state.intent && (
        <div style={{ marginTop: 40, textAlign: "center", opacity: 0.3 }}>
           <div className="float-anim" style={{ fontSize: 40, marginBottom: 12 }}>🛸</div>
           <div style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.02em' }}>READY FOR MISSION COMMAND</div>
        </div>
      )}
    </main>
  );
}
