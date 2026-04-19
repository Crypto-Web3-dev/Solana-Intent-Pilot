import { createWorkflowEngine } from "./workflow-engine";
import { createMockRuntimeServices } from "./runtime-services";
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

type WorkflowEngine = ReturnType<typeof createWorkflowEngine>;
type RuntimeServices = ReturnType<typeof createMockRuntimeServices>;

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

export function createMessageRouter(
  engine: WorkflowEngine = createWorkflowEngine(),
  services: RuntimeServices = createMockRuntimeServices()
) {
  const lastIntentByRequestId = new Map<string, SIPIntent>();
  const lastPreviewByRequestId = new Map<string, ExecutionPreviewReadyMessage["payload"]>();

  function pushState(events: SIPRuntimeMessage[], requestId: string) {
    events.push(createStateChangedMessage(requestId, engine.getState(requestId)));
  }

  function releaseState(requestId: string) {
    engine.clearState(requestId);
  }

  return {
    async handleIntentRequest(
      message: IntentParseRequestedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId, userInput, contextSnapshot } = message.payload;
      const events: SIPRuntimeMessage[] = [];
      let intent: SIPIntent;

      engine.start(requestId);
      pushState(events, requestId);

      try {
        intent = await services.parseIntent(userInput, contextSnapshot);
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
        releaseState(requestId);

        return events;
      }

      events.push({
        type: "intent.parse.succeeded",
        payload: {
          requestId,
          intent
        }
      } satisfies IntentParseSucceededMessage);
      lastIntentByRequestId.set(requestId, intent);

      engine.handleParsedIntent(requestId, intent);
      pushState(events, requestId);

      if (engine.getState(requestId)?.phase === "idle") {
        releaseState(requestId);
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
          const report = await services.scanRisk(intent);
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
            releaseState(requestId);
            return events;
          }
        } catch (error) {
          void error;

          engine.handleFailure(requestId, "risk-check-failed");
          pushState(events, requestId);
          releaseState(requestId);
          return events;
        }
      }

      engine.handleQuoteReady(requestId);
      pushState(events, requestId);

      try {
        const preview = await services.buildPreview(requestId, intent);
        engine.handlePreviewReady(requestId);
        pushState(events, requestId);
        events.push({
          type: "execution.preview.ready",
          payload: preview
        } satisfies ExecutionPreviewReadyMessage);
        lastPreviewByRequestId.set(requestId, preview);
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
        releaseState(requestId);
      }

      return events;
    },
    async handleExecutionConfirmed(
      message: ExecutionConfirmedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId } = message.payload;
      const state = engine.getState(requestId);

      if (state?.phase !== "awaiting-signature") {
        return [createStateChangedMessage(requestId, state)];
      }

      engine.handleExecutionConfirmed(requestId);

      return [createStateChangedMessage(requestId, engine.getState(requestId))];
    },
    handleExecutionCancelled(
      message: ExecutionCancelledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleExecutionCancelled(requestId);
      lastIntentByRequestId.delete(requestId);
      lastPreviewByRequestId.delete(requestId);
      const events = [createStateChangedMessage(requestId, engine.getState(requestId))];
      releaseState(requestId);

      return events;
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
      lastIntentByRequestId.delete(requestId);
      lastPreviewByRequestId.delete(requestId);
      const events = [createStateChangedMessage(requestId, engine.getState(requestId))];
      releaseState(requestId);

      return events;
    },
    handleTransactionSettled(
      message: TransactionSettledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;

      engine.handleTransactionSettled(requestId);
      lastIntentByRequestId.delete(requestId);
      lastPreviewByRequestId.delete(requestId);
      const events = [createStateChangedMessage(requestId, engine.getState(requestId))];
      releaseState(requestId);

      return events;
    }
  };
}
