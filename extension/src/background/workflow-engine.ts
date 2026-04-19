import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../shared/workflow";

type WorkflowState = {
  requestId: string;
  phase: WorkflowPhase;
  reason?: WorkflowReason;
};

export function isTerminalPhase(phase: WorkflowPhase) {
  return phase === "blocked" || phase === "failed";
}

export function createWorkflowEngine() {
  const states = new Map<string, WorkflowState>();
  const stickyIdleReasons = new Set<WorkflowReason>([
    "intent-invalid",
    "clarification-required"
  ]);

  function setState(
    requestId: string,
    phase: WorkflowPhase,
    reason?: WorkflowReason
  ) {
    states.set(requestId, { requestId, phase, reason });
  }

  function currentPhase(requestId: string) {
    const currentState = states.get(requestId);

    return currentState?.phase;
  }

  function clearState(requestId: string) {
    states.delete(requestId);
  }

  function isStickyIdleResolution(requestId: string) {
    const currentState = states.get(requestId);

    return (
      currentState?.phase === "idle" &&
      currentState.reason !== undefined &&
      stickyIdleReasons.has(currentState.reason)
    );
  }

  function handleSimulationReady(requestId: string) {
    if (currentPhase(requestId) !== "simulating") {
      return;
    }

    setState(requestId, "awaiting-signature");
  }

  function handlePreviewReady(requestId: string) {
    // Keep the older preview name as a boring alias for the simulation-ready transition.
    handleSimulationReady(requestId);
  }

  function handleExecutionConfirmed(requestId: string) {
    if (currentPhase(requestId) !== "awaiting-signature") {
      return;
    }

    setState(requestId, "submitting");
  }

  function handleExecutionCancelled(requestId: string) {
    if (currentPhase(requestId) !== "awaiting-signature") {
      return;
    }

    setState(requestId, "idle", "signature-cancelled");
  }

  function handleTransactionSubmitted(requestId: string) {
    if (currentPhase(requestId) !== "submitting") {
      return;
    }

    setState(requestId, "submitting");
  }

  function handleTransactionSettled(requestId: string) {
    if (currentPhase(requestId) !== "submitting") {
      return;
    }

    setState(requestId, "confirmed", "confirmed");
  }

  function handleSubmitFailed(requestId: string) {
    if (currentPhase(requestId) !== "submitting") {
      return;
    }

    setState(requestId, "failed", "submit-failed");
  }

  return {
    start(requestId: string) {
      if (isStickyIdleResolution(requestId)) {
        return;
      }

      setState(requestId, "parsing");
    },
    handleParsedIntent(requestId: string, intent: SIPIntent) {
      if (currentPhase(requestId) !== "parsing") {
        return;
      }

      if (intent.intent !== "SWAP") {
        setState(requestId, "idle", "intent-invalid");
        return;
      }

      if (intent.metadata.needsClarification) {
        setState(requestId, "idle", "clarification-required");
        return;
      }

      setState(
        requestId,
        intent.metadata.requiresRiskScan ? "risk-checking" : "quoting"
      );
    },
    handleRiskReport(requestId: string, report: SecurityReport) {
      if (currentPhase(requestId) !== "risk-checking") {
        return;
      }

      if (report.blocking) {
        setState(requestId, "blocked", "risk-blocked");
        return;
      }

      setState(requestId, "quoting");
    },
    handleQuoteReady(requestId: string) {
      if (currentPhase(requestId) !== "quoting") {
        return;
      }

      setState(requestId, "simulating");
    },
    handleSimulationReady,
    handlePreviewReady,
    handleExecutionConfirmed,
    handleExecutionCancelled,
    handleTransactionSubmitted,
    handleTransactionSettled,
    handleSubmitFailed,
    handleFailure(requestId: string, reason: WorkflowReason) {
      const phase = currentPhase(requestId);

      if (
        phase !== "parsing" &&
        phase !== "risk-checking" &&
        phase !== "quoting" &&
        phase !== "simulating" &&
        phase !== "submitting"
      ) {
        return;
      }

      setState(requestId, "failed", reason);
    },
    getState(requestId: string) {
      return states.get(requestId);
    },
    clearState(requestId: string) {
      clearState(requestId);
    }
  };
}
