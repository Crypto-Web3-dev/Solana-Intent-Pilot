import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../shared/workflow";

type ActionStatus = "pending" | "ready" | "failed";

type WorkflowState = {
  requestId: string;
  phase: WorkflowPhase;
  reason?: WorkflowReason;
  actionStates?: Record<string, ActionStatus>;
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
    reason?: WorkflowReason,
    actionStates?: Record<string, ActionStatus>
  ) {
    const currentState = states.get(requestId);
    states.set(requestId, {
      requestId,
      phase,
      reason,
      actionStates: actionStates ?? currentState?.actionStates
    });
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

      // 验证是否有动作
      if (!intent.actions || intent.actions.length === 0) {
        setState(requestId, "idle", "intent-invalid");
        return;
      }

      if (intent.metadata.needsClarification) {
        setState(requestId, "idle", "clarification-required");
        return;
      }

      // 初始化动作状态
      const actionStates: Record<string, ActionStatus> = {};
      intent.actions.forEach((action) => {
        actionStates[action.id] = "pending";
      });

      setState(
        requestId,
        intent.metadata.requiresRiskScan ? "risk-checking" : "quoting",
        undefined,
        actionStates
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
    handleActionReady(requestId: string, actionId: string) {
      const state = states.get(requestId);
      if (!state || !state.actionStates) return;

      const newActionStates = { ...state.actionStates, [actionId]: "ready" as const };
      
      // 检查是否所有动作都已就绪
      const allReady = Object.values(newActionStates).every((s) => s === "ready");

      if (allReady && state.phase === "quoting") {
        setState(requestId, "simulating", undefined, newActionStates);
      } else {
        setState(requestId, state.phase, state.reason, newActionStates);
      }
    },
    handleActionFailed(requestId: string, actionId: string) {
      const state = states.get(requestId);
      if (!state || !state.actionStates) return;

      const newActionStates = { ...state.actionStates, [actionId]: "failed" as const };
      setState(requestId, "failed", "quote-failed", newActionStates);
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
