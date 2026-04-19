import type { WorkflowPhase } from "../../shared/workflow";

function phaseLabel(phase: WorkflowPhase) {
  if (phase === "parsing") {
    return "Parsing request";
  }

  if (phase === "risk-checking") {
    return "Scanning token risk";
  }

  if (phase === "quoting") {
    return "Preparing quote";
  }

  if (phase === "simulating") {
    return "Simulating outcome";
  }

  if (phase === "awaiting-signature") {
    return "Preview ready";
  }

  if (phase === "submitting") {
    return "Submitting transaction";
  }

  if (phase === "confirmed") {
    return "Transaction confirmed";
  }

  if (phase === "blocked") {
    return "Blocked by policy";
  }

  if (phase === "failed") {
    return "Execution failed";
  }

  return "Ready for a new request";
}

export function DetectionBar({ phase }: { phase: WorkflowPhase }) {
  return <div>{phaseLabel(phase)}</div>;
}
