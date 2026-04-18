import {
  mockExecutionPreview,
  mockParseIntent,
  mockRiskScan
} from "./mock-services";
import { createWorkflowEngine } from "./workflow-engine";
import type { SIPIntent } from "../shared/intent";
import type {
  ExecutionCancelledMessage,
  ExecutionConfirmedMessage,
  ExecutionPreviewFailedMessage,
  ExecutionPreviewReadyMessage,
  IntentParseRequestedMessage,
  IntentParseFailedMessage,
  IntentParseSucceededMessage,
  RiskScanCompletedMessage,
  RiskScanRequestedMessage,
  SIPRuntimeMessage,
  TransactionFailedMessage,
  TransactionSettledMessage,
  TransactionSubmittedMessage,
  WorkflowStateChangedMessage
} from "../shared/messages";
import type { WorkflowPhase, WorkflowReason } from "../shared/workflow";

type WorkflowStateSnapshot = {
  requestId: string;
  phase: WorkflowPhase;
  reason?: WorkflowReason;
};

function createStateChangedMessage(
  requestId: string,
  phaseState: WorkflowStateSnapshot | undefined
): WorkflowStateChangedMessage {
  return {
    type: "workflow.state.changed",
    payload: phaseState ?? {
      requestId,
      phase: "idle"
    }
  };
}

export function createMessageRouter() {
  const engine = createWorkflowEngine();

  function pushState(events: SIPRuntimeMessage[], requestId: string) {
    events.push(createStateChangedMessage(requestId, engine.getState(requestId)));
  }

  return {
    async handleIntentRequest(
      message: IntentParseRequestedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId, userInput } = message.payload;
      const events: SIPRuntimeMessage[] = [];
      let intent: SIPIntent;

      engine.start(requestId);
      pushState(events, requestId);

      try {
        intent = await mockParseIntent(userInput);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Intent parse failed";

        events.push({
          type: "intent.parse.failed",
          payload: {
            requestId,
            reason,
            recoverable: false
          }
        } satisfies IntentParseFailedMessage);
        engine.handleFailure(requestId, "intent-invalid");
        pushState(events, requestId);

        return events;
      }

      events.push({
        type: "intent.parse.succeeded",
        payload: {
          requestId,
          intent
        }
      } satisfies IntentParseSucceededMessage);

      engine.handleParsedIntent(requestId, intent);
      pushState(events, requestId);

      if (engine.getState(requestId)?.phase === "idle") {
        return events;
      }

      if (engine.getState(requestId)?.phase === "risk-checking") {
        events.push({
          type: "risk.scan.requested",
          payload: {
            requestId,
            mintAddress: intent.payload.outputMint,
            sourceIntent: intent.payload
          }
        } satisfies RiskScanRequestedMessage);

        try {
          const report = await mockRiskScan(intent);
          events.push({
            type: "risk.scan.completed",
            payload: {
              requestId,
              report
            }
          } satisfies RiskScanCompletedMessage);

          engine.handleRiskReport(requestId, report);
          pushState(events, requestId);

          if (engine.getState(requestId)?.phase === "blocked") {
            return events;
          }
        } catch (error) {
          void error;

          engine.handleFailure(requestId, "risk-check-failed");
          pushState(events, requestId);
          return events;
        }
      }

      engine.handleQuoteReady(requestId);
      pushState(events, requestId);

      try {
        const preview = await mockExecutionPreview(requestId);
        engine.handlePreviewReady(requestId);
        pushState(events, requestId);
        events.push({
          type: "execution.preview.ready",
          payload: preview
        } satisfies ExecutionPreviewReadyMessage);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "simulation-failed";

        engine.handleFailure(requestId, "simulation-failed");
        events.push({
          type: "execution.preview.failed",
          payload: {
            requestId,
            stage: "simulate",
            reason
          }
        } satisfies ExecutionPreviewFailedMessage);
        pushState(events, requestId);
      }

      return events;
    },
    handleExecutionConfirmed(
      message: ExecutionConfirmedMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleExecutionConfirmed(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    },
    handleExecutionCancelled(
      message: ExecutionCancelledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleExecutionCancelled(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    },
    handleTransactionSubmitted(
      message: TransactionSubmittedMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleTransactionSubmitted(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    },
    handleTransactionFailed(
      message: TransactionFailedMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleSubmitFailed(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    },
    handleTransactionSettled(
      message: TransactionSettledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleTransactionSettled(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    }
  };
}
