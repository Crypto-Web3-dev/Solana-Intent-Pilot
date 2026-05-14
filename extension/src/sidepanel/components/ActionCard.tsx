import { useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import type { ExecutionPreview } from "../../shared/execution";
import type { ClarificationPayload, SIPIntent } from "../../shared/intent";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";
import type { WalletStatus } from "../wallet-state";

const cardStyles = {
  container: (riskLevel?: string) => ({
    padding: 16,
    border: `1px solid ${riskLevel === "high" ? "rgba(255, 75, 75, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
    borderRadius: 20,
    background: riskLevel === "high" ? "rgba(255, 75, 75, 0.05)" : "rgba(255, 255, 255, 0.04)",
    backdropFilter: "blur(10px)"
  }),
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerLabel: (riskLevel?: string) => ({
    fontSize: 10,
    fontWeight: 800,
    color: riskLevel === "high" ? "#FF4B4B" : "#94a3b8",
    letterSpacing: "0.1em"
  }),
  typeBadge: (riskLevel?: string) => ({
    padding: "4px 8px",
    borderRadius: 6,
    background: riskLevel === "high" ? "rgba(255, 75, 75, 0.1)" : "rgba(255, 255, 255, 0.06)",
    fontSize: 10,
    fontWeight: 700,
    color: riskLevel === "high" ? "#FF4B4B" : "#38bdf8"
  }),
  balanceBox: {
    margin: "0 0 16px 0",
    padding: "16px",
    background: "rgba(255, 255, 255, 0.03)",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "1px solid rgba(255, 255, 255, 0.05)"
  }
};

const ERROR_MAP: Record<string, string> = {
  "User rejected the request": "Signature cancelled by user",
  "submit-failed": "Transaction failed to broadcast",
  "simulation-failed": "Execution check failed",
  "insufficient funds": "Insufficient balance for this trade"
};

export function ActionCard({
  preview,
  intent,
  risk,
  phase,
  reason,
  clarification,
  walletStatus,
  isSigning,
  onConfirm,
  onRetry,
  onCancel,
  onFailSubmit,
  onSettle,
  onOpenNormalPage
}: {
  preview: ExecutionPreview | null;
  intent: SIPIntent | null;
  risk?: SecurityReport | null;
  phase: WorkflowPhase;
  reason: WorkflowReason | string | null;
  clarification?: ClarificationPayload | null;
  walletStatus: WalletStatus;
  isSigning: boolean;
  onConfirm: () => void;
  onRetry?: () => void;
  onCancel: () => void;
  onFailSubmit: () => void;
  onSettle: () => void;
  onOpenNormalPage: () => void;
}) {
  const isSucceeded = phase === "confirmed" || (phase === "idle" && reason === "transaction-settled");
  const isFailed = phase === "failed";
  const isUnsupportedPage = phase === "blocked" && reason === "unsupported-page";

  const isDegradedPreview = Boolean(preview?.simulationSummary) &&
    /(degraded|failed|not configured|not fully verified)/i.test(preview?.simulationSummary ?? "");

  useEffect(() => {
    if (phase === "confirmed") {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#38bdf8", "#10b981", "#9945FF", "#14F195"]
      });
    }
  }, [phase]);

  function formatSummary(summary?: string): string {
    if (!summary) return "Ready to execute.";

    let formatted = summary;
    for (const [raw, friendly] of Object.entries(ERROR_MAP)) {
      if (formatted.toLowerCase().includes(raw.toLowerCase())) return friendly;
    }

    return formatted
      .replace(/1000000000/g, "1.0")
      .replace(/So11111111111111111111111111111111111111112/g, "SOL")
      .replace(/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/g, "BONK")
      .replace("Success (RPC): Consumed ", "Est. CU: ")
      .replace("Simulation Logic Failed:", "Failed:");
  }

  function getRiskConfirmation() {
    const statusMap: Record<string, any> = {
      high: {
        title: "High risk warning",
        detail: "Serious risk signals were detected. Review the checks above before choosing to continue.",
        button: "Confirm High Risk & Continue",
        color: "#FF4B4B",
        background: "rgba(255, 75, 75, 0.08)",
        border: "rgba(255, 75, 75, 0.24)"
      },
      medium: {
        title: "Medium risk warning",
        detail: "Some risk signals were detected. Continue only if this matches your intent.",
        button: "Review Risk & Continue",
        color: "#fbbf24",
        background: "rgba(251, 191, 36, 0.08)",
        border: "rgba(251, 191, 36, 0.24)"
      },
      unknown: {
        title: "Incomplete risk data",
        detail: "SIP could not verify all risk inputs. This is not a safe result.",
        button: "Acknowledge Risk & Continue",
        color: "#fbbf24",
        background: "rgba(251, 191, 36, 0.08)",
        border: "rgba(251, 191, 36, 0.24)"
      }
    };

    if (!risk)
      return {
        title: "Risk checks pending",
        detail: "Confirm only after reviewing the execution preview.",
        button: "Confirm & Continue",
        color: "#94a3b8",
        background: "rgba(148, 163, 184, 0.08)",
        border: "rgba(148, 163, 184, 0.2)"
      };

    return statusMap[risk.level] || {
      title: "Low risk checks passed",
      detail: "No major risk signals were detected by the current checks.",
      button: "Confirm & Continue",
      color: "#10b981",
      background: "rgba(16, 185, 129, 0.08)",
      border: "rgba(16, 185, 129, 0.22)"
    };
  }

  function getDecimals(symbol?: string, explicitDecimals?: number): number {
    if (typeof explicitDecimals === "number") return explicitDecimals;
    const s = symbol?.toUpperCase();
    if (s === "USDC" || s === "USDT") return 6;
    if (s === "BONK" || s === "BONKRADIO") return 5;
    return 9;
  }

  function formatAmountWithSymbol(amount: string, symbol?: string, explicitDecimals?: number): string {
    if (amount === "multi" || amount === "Multi") return "Varies";
    const val = Number(amount);
    if (isNaN(val)) return amount;
    const decimals = getDecimals(symbol, explicitDecimals);
    const formatted = (val / Math.pow(10, decimals)).toFixed(4);
    return `${parseFloat(formatted).toString()} ${symbol || "Tokens"}`;
  }

  if (isSucceeded) {
    return (
      <div className="success-card" style={{ padding: 16, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: "bold", fontSize: 18, color: "#10b981" }}>Transaction Complete</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9, color: "#94a3b8" }}>
          Your swap was successfully executed on Solana.
        </div>
        {preview?.signature && (
          <a href={`https://solscan.io/tx/${preview.signature}`} target="_blank" className="explorer-button" rel="noreferrer">
            View on Solscan
          </a>
        )}
      </div>
    );
  }

  if (isFailed) {
    const canRetry = Boolean(preview);
    return (
      <div style={{ padding: 16, background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: 16 }}>
        <div style={{ fontWeight: "bold", color: "#f87171", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>⚠️</span> Execution Paused
        </div>
        <div style={{ fontSize: 13, marginTop: 10, color: "#94a3b8", lineHeight: 1.4 }}>
          {formatSummary(reason ?? undefined)}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {canRetry && onRetry && (
            <button onClick={onRetry} style={{
              flex: 2,
              padding: "12px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
              color: "#082f49",
              fontWeight: 700,
              border: 0,
              cursor: "pointer"
            }}>
              Retry Signature
            </button>
          )}
          <button onClick={onCancel} style={{
            flex: 1,
            padding: "12px",
            borderRadius: 10,
            border: "1px solid rgba(248, 113, 113, 0.3)",
            background: "rgba(255, 255, 255, 0.05)",
            color: "#f8fafc",
            fontWeight: 600,
            cursor: "pointer"
          }}>
            {canRetry ? "Cancel" : "Reset & Try Again"}
          </button>
        </div>
      </div>
    );
  }

  const actionPayload = intent?.actions?.[0]?.payload || {};
  const { inputSymbol = "SOL", outputSymbol = "Tokens", inputDecimals, outputDecimals } = actionPayload;
  const riskConfirmation = getRiskConfirmation();

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      style={cardStyles.container(risk?.level)}>
      {preview ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>Action</span>
            <span style={{ fontWeight: "600", color: "#38bdf8", fontSize: 13 }}>
              {preview.routeLabel === "Atomic Bundle" ? "Atomic Strategy" : "Direct Swap"}
            </span>
          </div>

          <div style={cardStyles.balanceBox}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>PAY</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#9945FF" }}>
                {formatAmountWithSymbol(preview.inputAmount, inputSymbol, inputDecimals)}
              </span>
            </div>
            <div style={{ color: "#64748b", fontSize: 20 }}>➔</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
              <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700 }}>RECEIVE</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#14F195" }}>
                {preview.outputAmount === "Multi" ? "Targets" : formatAmountWithSymbol(preview.outputAmount, outputSymbol, outputDecimals)}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10, fontSize: 12, color: "#94a3b8", borderLeft: "3px solid #0ea5e9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Estimated Network Fee:</span>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>
                {preview.estimatedFeeLamports ? `${(Number(preview.estimatedFeeLamports) / 1e9).toFixed(6)} SOL` : "Unknown"}
              </span>
            </div>
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.05)", paddingTop: 6, marginTop: 4 }}>
              {(() => {
                const summary = formatSummary(preview.simulationSummary);
                if (summary.startsWith("Est. CU:")) {
                  return (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b", fontSize: 12 }}>Estimated Compute Units:</span>
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>{summary.replace("Est. CU: ", "")}</span>
                    </div>
                  );
                }
                return <div style={{ color: "#94a3b8", fontSize: 12 }}>{summary}</div>;
              })()}
            </div>
          </div>

          {isDegradedPreview && (
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: 12, color: "#fcd34d", lineHeight: 1.4 }}>
              <strong>Note:</strong> Preview is running in a degraded state.
            </div>
          )}
        </div>
      ) : (
        <div
          className={phase === "risk-checking" ? "scan-ray-container" : ""}
          style={{
            margin: "24px 0",
            padding: "24px 0",
            textAlign: "center",
            color: "#64748b",
            fontSize: 14,
            borderRadius: 16,
            background: phase === "risk-checking" ? "rgba(56, 189, 248, 0.03)" : "transparent",
            border: phase === "risk-checking" ? "1px dashed rgba(56, 189, 248, 0.2)" : "none",
            position: "relative"
          }}>
          {phase === "risk-checking" && <div className="scan-ray" />}
          {phase === "quoting" || phase === "simulating"
            ? "Synthesizing strategy..."
            : phase === "risk-checking"
              ? "Scanning for risks..."
              : "Waiting for intent..."}
        </div>
      )}

      {phase === "awaiting-signature" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: 10, borderRadius: 10, background: riskConfirmation.background, border: `1px solid ${riskConfirmation.border}`, color: riskConfirmation.color, fontSize: 12, lineHeight: 1.4, marginBottom: 10 }}>
            <div style={{ fontWeight: 800, marginBottom: 3 }}>{riskConfirmation.title}</div>
            <div style={{ color: "#cbd5e1" }}>{riskConfirmation.detail}</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onConfirm}
              disabled={isSigning || isDegradedPreview}
              style={{
                flex: 1,
                padding: "14px",
                borderRadius: 12,
                background: isDegradedPreview ? "#1e293b" : risk?.level === "high" ? "linear-gradient(135deg, #FF4B4B 0%, #ef4444 100%)" : "linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)",
                color: isDegradedPreview ? "#64748b" : risk?.level === "high" ? "#fff" : "#082f49",
                fontWeight: 800,
                border: 0,
                cursor: isSigning || isDegradedPreview ? "not-allowed" : "pointer",
                boxShadow: isDegradedPreview ? "none" : "0 4px 12px rgba(14, 165, 233, 0.2)"
              }}>
              {isSigning ? "Signing..." : isDegradedPreview ? "Verification Failed" : riskConfirmation.button}
            </button>
            <button onClick={onCancel} style={{ padding: "14px 20px", borderRadius: 12, background: "rgba(255, 255, 255, 0.05)", color: "#f8fafc", border: "1px solid rgba(255, 255, 255, 0.1)", fontWeight: 600, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {isUnsupportedPage && (
        <button onClick={onOpenNormalPage} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, background: "#f59e0b", color: "#000", border: 0, fontWeight: 700, cursor: "pointer" }}>
          Open supported page
        </button>
      )}
    </motion.div>
  );
}
