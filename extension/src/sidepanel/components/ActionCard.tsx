import type { ExecutionPreview } from "../../shared/execution";
import type { ClarificationPayload } from "../../shared/intent";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";
import type { WalletStatus } from "../wallet-state";

export function ActionCard({
  preview,
  phase,
  reason,
  clarification,
  walletStatus,
  isSigning,
  onConfirm,
  onCancel,
  onOpenNormalPage
}: {
  preview: ExecutionPreview | null;
  phase: WorkflowPhase;
  reason: WorkflowReason | string | null;
  clarification?: ClarificationPayload | null;
  walletStatus: WalletStatus;
  isSigning: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onFailSubmit: () => void;
  onSettle: () => void;
  onOpenNormalPage: () => void;
}) {
  const isSucceeded = phase === "confirmed" || (phase === "idle" && reason === "transaction-settled");
  const isFailed = phase === "failed";
  const isUnsupportedPage = phase === "blocked" && reason === "unsupported-page";
  
  if (isSucceeded) {
    return (
      <div className="success-card" style={{ padding: 16, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
        <div style={{ fontWeight: "bold", fontSize: 18 }}>Transaction Complete</div>
        <div style={{ fontSize: 13, marginTop: 8, opacity: 0.9 }}>
          Your swap was successfully executed on Solana.
        </div>
        {preview?.signature && (
          <a 
            href={`https://solscan.io/tx/${preview.signature}`} 
            target="_blank" 
            className="explorer-button"
            rel="noreferrer"
          >
            View on Solscan
          </a>
        )}
      </div>
    );
  }

  if (isFailed) {
    return (
      <div style={{ padding: 12, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", borderRadius: 12 }}>
        <div style={{ fontWeight: "bold", color: "#ef4444" }}>Execution Failed</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{reason || "An unknown error occurred during execution."}</div>
        <button onClick={onCancel} style={{ marginTop: 12, padding: "6px 12px", borderRadius: 8, border: "1px solid #ef4444", background: "none", color: "#ef4444", cursor: "pointer" }}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 12, border: "1px solid #334155", borderRadius: 12, background: "rgba(15, 23, 42, 0.3)" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>Execution Preview</div>
      
      {preview ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>Route</span>
            <span style={{ fontWeight: "bold", color: "#38bdf8" }}>{preview.routeLabel}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span>Min Output</span>
            <span style={{ fontWeight: "bold" }}>{preview.outputAmount} tokens</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
            <span>Est. Fee</span>
            <span>{preview.estimatedFeeLamports} lamports</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, fontStyle: "italic", opacity: 0.8 }}>
            Sim: {preview.simulationSummary}
          </div>
        </div>
      ) : (
        <div style={{ margin: "20px 0", textAlign: "center", color: "#64748b" }}>
          {phase === "quoting" || phase === "simulating" ? "Preparing preview..." : "Waiting for intent..."}
        </div>
      )}

      {phase === "awaiting-signature" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            onClick={onConfirm} 
            disabled={isSigning}
            style={{ flex: 1, padding: 12, borderRadius: 10, background: "#38bdf8", color: "#082f49", fontWeight: "bold", border: 0, cursor: isSigning ? "not-allowed" : "pointer" }}
          >
            {isSigning ? "Sign in Wallet..." : "Confirm & Swap"}
          </button>
          <button 
            onClick={onCancel}
            style={{ padding: 12, borderRadius: 10, background: "rgba(100, 116, 139, 0.2)", color: "white", border: 0, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}

      {isUnsupportedPage && (
        <button onClick={onOpenNormalPage} style={{ width: "100%", padding: 10, borderRadius: 8, background: "#f59e0b", color: "black", border: 0, fontWeight: "bold", cursor: "pointer" }}>
          Switch to normal tab
        </button>
      )}
    </div>
  );
}
