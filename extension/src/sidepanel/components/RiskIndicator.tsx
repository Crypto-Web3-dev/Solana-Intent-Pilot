import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase } from "../../shared/workflow";

const cardStyles = {
  high: { background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444" },
  medium: { background: "rgba(245, 158, 11, 0.15)", border: "1px solid #f59e0b" },
  low: { background: "rgba(16, 185, 129, 0.15)", border: "1px solid #10b981" }
};

export function RiskIndicator({
  risk,
  phase
}: {
  risk: SecurityReport | null;
  phase: WorkflowPhase;
}) {
  const isScanning = phase === "simulating" || phase === "quoting";
  
  if (isScanning) {
    return (
      <div className="scanning-container" style={{ padding: 12, border: "1px solid #334155", borderRadius: 12, background: "rgba(30, 41, 59, 0.5)" }}>
        <div className="scanning-line" />
        <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>Risk Assessment</div>
        <div style={{ color: "#38bdf8", fontWeight: "bold", marginTop: 4 }}>Wasm engine is auditing...</div>
      </div>
    );
  }

  if (!risk) return null;

  const style = risk.blocking ? cardStyles.high : (cardStyles[risk.level as keyof typeof cardStyles] || cardStyles.low);

  return (
    <div style={{ ...style, padding: 12, borderRadius: 12, transition: "all 0.3s" }}>
      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase" }}>
        Risk: {risk.level.toUpperCase()}
      </div>
      <div style={{ marginTop: 4, fontWeight: "bold", fontSize: 16 }}>
        {risk.blocking ? "BLOCKED: " : ""}{risk.summary}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
        Engine: {risk.source === "wasm" ? "Rust/Wasm Core" : "Heuristic Policy"} • Score: {risk.score}
      </div>
      {risk.checks && risk.checks.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          {risk.checks.map((c, i) => (
            <div key={i} style={{ color: c.status === "pass" ? "#10b981" : "#f59e0b" }}>
              • {c.label}: {c.status.toUpperCase()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
