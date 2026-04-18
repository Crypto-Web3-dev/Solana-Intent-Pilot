import type { SIPIntent } from "../../shared/intent";
import type { WorkflowPhase } from "../../shared/workflow";

export function IntentSummaryCard({
  intent,
  phase
}: {
  intent: SIPIntent | null;
  phase: WorkflowPhase;
}) {
  if (phase === "parsing") {
    return <div>Interpreting your request into a structured intent.</div>;
  }

  if (!intent) {
    return <div>No intent yet.</div>;
  }

  return (
    <div>
      <div>Intent: {intent.intent}</div>
      <div>{intent.metadata.reasoning}</div>
    </div>
  );
}
