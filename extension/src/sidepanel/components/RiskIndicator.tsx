import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase } from "../../shared/workflow";

export function RiskIndicator({
  risk,
  phase
}: {
  risk: SecurityReport | null;
  phase: WorkflowPhase;
}) {
  if (phase === "risk-checking") {
    return <div>Risk: scanning...</div>;
  }

  if (!risk) {
    return <div>Risk: no report yet</div>;
  }

  const sourceLabel =
    risk.source === "wasm" ? "Wasm" : "policy fallback";

  if (risk.level === "unknown") {
    return (
      <div>
        <div>Risk: unknown - data is incomplete</div>
        <div>Risk source: {sourceLabel}</div>
      </div>
    );
  }

  if (risk.blocking) {
    return (
      <div>
        <div>Risk: blocked - {risk.summary}</div>
        <div>Risk source: {sourceLabel}</div>
      </div>
    );
  }

  return (
    <div>
      <div>Risk: {risk.level}</div>
      <div>Risk source: {sourceLabel}</div>
    </div>
  );
}
