import type { SIPIntent } from "../shared/intent";
import type { SecurityReport } from "../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../shared/workflow";

type ActionStatus = "pending" | "ready" | "failed";

type WorkflowState = {
  requestId: string;
  phase: WorkflowPhase;
  reason?: WorkflowReason | string;
  actionStates?: Record<string, ActionStatus>;
};

export function isTerminalPhase(phase: WorkflowPhase) {
  return phase === "blocked" || phase === "failed" || phase === "confirmed";
}

export function createWorkflowEngine() {
  const states = new Map<string, WorkflowState>();
  const stickyIdleReasons = new Set<WorkflowReason | string>([
    "intent-invalid",
    "clarification-required"
  ]);

  function setState(
    requestId: string,
    phase: WorkflowPhase,
    reason?: WorkflowReason | string,
    actionStates?: Record<string, ActionStatus>
  ) {
    const currentState = states.get(requestId);
    const finalActionStates = actionStates ?? currentState?.actionStates;

    states.set(requestId, {
      requestId,
      phase,
      reason: reason ?? (phase === currentState?.phase ? currentState?.reason : undefined),
      actionStates: finalActionStates
    });
  }

  function currentPhase(requestId: string) {
    return states.get(requestId)?.phase;
  }

  return {
    start(requestId: string) {
      const currentState = states.get(requestId);
      if (currentState?.phase === "idle" && currentState.reason && stickyIdleReasons.has(currentState.reason)) {
        return;
      }
      setState(requestId, "parsing");
    },
    handleParsedIntent(requestId: string, intent: SIPIntent) {
      const phase = currentPhase(requestId);
      if (phase !== "parsing" && phase !== "idle" && phase !== undefined) return;    

      if (!intent.actions || intent.actions.length === 0) {
        setState(requestId, "idle", "intent-invalid");
        return;
      }

      if (intent.metadata.needsClarification) {
        setState(requestId, "idle", "clarification-required");
        return;
      }

      const actionStates: Record<string, ActionStatus> = {};
      intent.actions.forEach((a) => {
        actionStates[a.id] = "pending";
      });

      setState(
        requestId,
        intent.metadata.requiresRiskScan ? "risk-checking" : "quoting",
        undefined,
        actionStates
      );
    },
    handleRiskReport(requestId: string, report: SecurityReport) {
      if (currentPhase(requestId) !== "risk-checking") return;

      if (report.blocking) {
        setState(requestId, "blocked", "risk-blocked");
      } else {
        setState(requestId, "quoting");
      }
    },
    handleActionReady(requestId: string, actionId: string) {
      const state = states.get(requestId);
      if (!state || !state.actionStates) return;

      const newActionStates = { ...state.actionStates, [actionId]: "ready" as const };
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
      if (currentPhase(requestId) === "quoting") {
        setState(requestId, "simulating");
      }
    },
    handleSimulationReady(requestId: string) {
      if (currentPhase(requestId) === "simulating") {
        setState(requestId, "awaiting-signature");
      }
    },
    handlePreviewReady(requestId: string) {
      const phase = currentPhase(requestId);
      if (phase === "simulating") {
        setState(requestId, "awaiting-signature");
      }
    },
    handleExecutionConfirmed(requestId: string) {
      if (currentPhase(requestId) === "awaiting-signature") {
        setState(requestId, "submitting");
      }
    },
    handleExecutionCancelled(requestId: string) {
      // 核心修复：允许随时取消并标记为失败状态
      setState(requestId, "failed", "Signature cancelled by user.");
    },
    handleRetrySignature(requestId: string) {
      const currentState = states.get(requestId);
      if (currentState?.phase === "failed" || currentState?.phase === "idle") {
        setState(requestId, "awaiting-signature");
      }
    },
    handleTransactionSubmitted(requestId: string) {
      // submitting
    },
    handleTransactionSettled(requestId: string) {
      if (currentPhase(requestId) === "submitting") {
        setState(requestId, "confirmed", "confirmed");
      }
    },
    handleSubmitFailed(requestId: string) {
      if (currentPhase(requestId) === "submitting") {
        setState(requestId, "failed", "submit-failed");
      }
    },
    handleFailure(requestId: string, reason: WorkflowReason | string) {
      const phase = currentPhase(requestId);
      // 核心修复：允许从“待签名”等状态直接进入失败
      if (phase && !isTerminalPhase(phase)) {      
        setState(requestId, "failed", reason);
      }
    },
    getState(requestId: string) {
      return states.get(requestId);
    },
    clearState(requestId: string) {
      states.delete(requestId);
    }
  };
}
