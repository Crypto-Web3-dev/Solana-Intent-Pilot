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

  if (risk.level === "unknown") {
    return <div>Risk: unknown - data is incomplete</div>;
  }

  if (risk.blocking) {
    return <div>Risk: blocked - {risk.summary}</div>;
  }

  return <div>Risk: {risk.level}</div>;
}
