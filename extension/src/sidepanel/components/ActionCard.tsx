import type { ExecutionPreview } from "../../shared/execution";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";

function phaseMessage(phase: WorkflowPhase, reason: WorkflowReason | string | null) {
  if (phase === "blocked") {
    return "Execution is blocked by policy.";
  }

  if (phase === "failed") {
    return `Execution failed${reason ? `: ${reason}` : ""}`;
  }

  if (phase === "idle" && reason === "clarification-required") {
    return "More information is needed before we can continue.";
  }

  if (phase === "awaiting-signature") {
    return "Preview is ready. Waiting for wallet confirmation.";
  }

  if (phase === "submitting") {
    return "Transaction is being submitted.";
  }

  if (phase === "confirmed") {
    return "Transaction confirmed.";
  }

  if (phase === "simulating") {
    return "Simulation in progress.";
  }

  if (phase === "quoting") {
    return "Quote in progress.";
  }

  return `Phase: ${phase}`;
}

export function ActionCard({
  preview,
  phase,
  reason,
  onConfirm,
  onCancel,
  onFailSubmit,
  onSettle
}: {
  preview: ExecutionPreview | null;
  phase: WorkflowPhase;
  reason: WorkflowReason | string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onFailSubmit: () => void;
  onSettle: () => void;
}) {
  return (
    <div>
      <div>{phaseMessage(phase, reason)}</div>
      {preview ? (
        <div>
          <div>Route: {preview.routeLabel}</div>
          <div>Output: {preview.outputAmount}</div>
        </div>
      ) : null}
      {phase === "awaiting-signature" ? (
        <div>
          <button onClick={onConfirm}>Mock Confirm Signature</button>
          <button onClick={onCancel}>Mock Cancel Signature</button>
        </div>
      ) : null}
      {phase === "submitting" ? (
        <div>
          <button onClick={onSettle}>Mock Settle</button>
          <button onClick={onFailSubmit}>Mock Submit Failure</button>
        </div>
      ) : null}
    </div>
  );
}
