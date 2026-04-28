import { createWorkflowEngine } from "./workflow-engine";
import { createMockRuntimeServices } from "./runtime-services";
import type { SIPIntent } from "../shared/intent";
import type {
  ExecutionCancelRequestedMessage,
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
  reason?: WorkflowReason | string;
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
  services: RuntimeServices = createMockRuntimeServices(),
  onEvent?: (event: SIPRuntimeMessage) => void
) {
  const lastIntentByRequestId = new Map<string, SIPIntent>();
  const lastPreviewByRequestId = new Map<string, ExecutionPreviewReadyMessage["payload"]>();
  const cancelledRequestIds = new Set<string>();

  function pushState(requestId: string) {
    const state = engine.getState(requestId);
    const event = createStateChangedMessage(requestId, state);
    onEvent?.(event);
  }

  function releaseState(requestId: string) {
    engine.clearState(requestId);
    cancelledRequestIds.delete(requestId);
  }

  function isCancelled(requestId: string) {
    return cancelledRequestIds.has(requestId);
  }

  return {
    handleCancelRequested(message: ExecutionCancelRequestedMessage): SIPRuntimeMessage[] {
        const { requestId } = message.payload;
        cancelledRequestIds.add(requestId);
        engine.handleExecutionCancelled(requestId);
        
        pushState(requestId);
        releaseState(requestId);
        return []; // 核心优化：改用推送机制，不再通过返回值传递事件
    },

    handleRetryRequested(message: { payload: { requestId: string } }): SIPRuntimeMessage[] {
        const { requestId } = message.payload;
        engine.handleRetrySignature(requestId);
        pushState(requestId);
        return [];
    },

    async handleIntentRequest(
      message: IntentParseRequestedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId, userInput, contextSnapshot, userPublicKey } = message.payload;
      let intent: SIPIntent;

      engine.start(requestId);
      pushState(requestId);

      const checkCancelled = () => {
          if (isCancelled(requestId)) {
              throw new Error("OPERATION_ABORTED");
          }
      };

      try {
        intent = await services.parseIntent(userInput, contextSnapshot, userPublicKey);
        checkCancelled();

        if (userPublicKey) {
          intent.actions?.forEach((a) => {
            if (a.payload) {
                a.payload.userPublicKey = userPublicKey;
            }
          });
        }
      } catch (error: any) {
        if (error.message === "OPERATION_ABORTED") return [];
        
        let reason = error instanceof Error ? error.message : "Intent parse failed";
        if (reason.includes("Jito")) {
            reason = "Service provider error during token resolution. Please retry.";
        }

        engine.handleFailure(requestId, "intent-invalid");
        const failedEvent: IntentParseFailedMessage = {
          type: "intent.parse.failed",
          payload: { requestId, reason, recoverable: false }
        };
        onEvent?.(failedEvent);

        pushState(requestId);
        releaseState(requestId);
        return [];
      }

      const succeededEvent: IntentParseSucceededMessage = {
        type: "intent.parse.succeeded",
        payload: { requestId, intent }
      };
      onEvent?.(succeededEvent);

      lastIntentByRequestId.set(requestId, intent);
      engine.handleParsedIntent(requestId, intent);
      pushState(requestId);

      const stateAfterParse = engine.getState(requestId);
      if (stateAfterParse?.phase === "idle") {
        releaseState(requestId);
        return [];
      }

      if (stateAfterParse?.phase === "risk-checking") {
        const riskRequestedEvent: RiskScanRequestedMessage = {
          type: "risk.scan.requested",
          payload: {
            requestId,
            mintAddress: intent.actions[0]?.payload?.outputMint || "",
            sourceAction: intent.actions[0]
          }
        };
        onEvent?.(riskRequestedEvent);

        try {
          const report = await services.scanRisk(intent);
          checkCancelled();

          const riskCompletedEvent: RiskScanCompletedMessage = {
            type: "risk.scan.completed",
            payload: { requestId, report }
          };
          onEvent?.(riskCompletedEvent);

          engine.handleRiskReport(requestId, report);
          pushState(requestId);

          const stateAfterRisk = engine.getState(requestId);
          if (stateAfterRisk?.phase === "blocked" || stateAfterRisk?.phase === "failed") {
            releaseState(requestId);
            return [];
          }
        } catch (error: any) {
          if (error.message === "OPERATION_ABORTED") return [];
          engine.handleFailure(requestId, "risk-check-failed");
          pushState(requestId);
          releaseState(requestId);
          return [];
        }
      }

      const transactions: string[] = [];
      const actions = intent.actions || [];
      let currentActionId: string | null = null;
      let lastQuote: any = null;

      try {
        for (const action of actions) {
          currentActionId = action.id;
          const { quote, swapTransaction } = await services.getOrder(action);
          checkCancelled();

          lastQuote = quote;
          transactions.push(swapTransaction);
          engine.handleActionReady(requestId, action.id);
          pushState(requestId);
        }
      } catch (error: any) {
        if (error.message === "OPERATION_ABORTED") return [];
        const reason = error instanceof Error ? error.message : "Jupiter quote request failed";

        if (currentActionId) {
          engine.handleActionFailed(requestId, currentActionId);
        } else {
          engine.handleFailure(requestId, "quote-failed");
        }

        const previewFailedEvent: ExecutionPreviewFailedMessage = {
          type: "execution.preview.failed",
          payload: { requestId, stage: "quote", reason }
        };
        onEvent?.(previewFailedEvent);

        pushState(requestId);
        releaseState(requestId);
        return [];
      }

      try {
        const bundleSimulation = await services.simulateBundle(transactions);
        checkCancelled();

        if (
          bundleSimulation &&
          typeof bundleSimulation === "object" &&
          "success" in bundleSimulation &&
          bundleSimulation.success === false
        ) {
          throw new Error(
            ("error" in bundleSimulation && typeof bundleSimulation.error === "string"
              ? bundleSimulation.error
              : undefined) ||
              ("summary" in bundleSimulation && typeof bundleSimulation.summary === "string"
                ? bundleSimulation.summary
                : undefined) ||
              "simulation-failed"
          );
        }

        const preview = await services.buildPreview(requestId, intent, transactions, bundleSimulation, lastQuote);
        checkCancelled();

        engine.handlePreviewReady(requestId);
        pushState(requestId);
        
        const previewReadyEvent: ExecutionPreviewReadyMessage = {
          type: "execution.preview.ready",
          payload: preview
        };
        onEvent?.(previewReadyEvent);
        
        lastPreviewByRequestId.set(requestId, preview);
      } catch (error: any) {
        if (error.message === "OPERATION_ABORTED") return [];
        let reason = error instanceof Error ? error.message : "simulation-failed";
        
        if (reason.includes("Jito")) {
            reason = "Temporary provider congestion. Please try again or check settings.";
        }

        engine.handleFailure(requestId, "simulation-failed");
        const previewFailedEvent: ExecutionPreviewFailedMessage = {
          type: "execution.preview.failed",
          payload: { requestId, stage: "simulate", reason }
        };
        onEvent?.(previewFailedEvent);

        pushState(requestId);
        releaseState(requestId);
      }

      return [];
    },

    async handleExecutionConfirmed(
      message: ExecutionConfirmedMessage
    ): Promise<SIPRuntimeMessage[]> {
      const { requestId } = message.payload;
      const state = engine.getState(requestId);

      if (state?.phase !== "awaiting-signature") {
        pushState(requestId);
        return [];
      }

      engine.handleExecutionConfirmed(requestId);
      pushState(requestId);
      return [];
    },

    handleExecutionCancelled(
      message: ExecutionCancelledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;
      engine.handleExecutionCancelled(requestId);
      pushState(requestId);
      return [];
    },

    handleTransactionSubmitted(
      message: TransactionSubmittedMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;
      engine.handleTransactionSubmitted(requestId);
      pushState(requestId);
      return [];
    },

    handleTransactionFailed(
      message: TransactionFailedMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;
      engine.handleSubmitFailed(requestId);
      pushState(requestId);
      return [];
    },

    handleTransactionSettled(
      message: TransactionSettledMessage
    ): SIPRuntimeMessage[] {
      const { requestId } = message.payload;
      engine.handleTransactionSettled(requestId);
      lastIntentByRequestId.delete(requestId);
      lastPreviewByRequestId.delete(requestId);
      pushState(requestId);
      releaseState(requestId);
      return [];
    }
  };
}
