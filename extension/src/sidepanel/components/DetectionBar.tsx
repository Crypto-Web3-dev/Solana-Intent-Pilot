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

  return "Detected context ready";
}

export function DetectionBar({ phase }: { phase: WorkflowPhase }) {
  return <div>{phaseLabel(phase)}</div>;
}
