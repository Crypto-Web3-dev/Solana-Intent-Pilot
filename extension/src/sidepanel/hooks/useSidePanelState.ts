import { useRef, useState } from "react";
import { createMessageRouter } from "../../background/message-router";
import type { ExecutionPreview } from "../../shared/execution";
import type { SIPIntent } from "../../shared/intent";
import type {
  ExecutionCancelledMessage,
  ExecutionConfirmedMessage,
  SIPRuntimeMessage,
  TransactionFailedMessage,
  TransactionSettledMessage
} from "../../shared/messages";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";

const router = createMessageRouter();

function createRequestId(sequence: number) {
  return `req-ui-${sequence}`;
}

export function useSidePanelState() {
  const requestSequence = useRef(1);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>("idle");
  const [reason, setReason] = useState<WorkflowReason | string | null>(null);
  const [intent, setIntent] = useState<SIPIntent | null>(null);
  const [risk, setRisk] = useState<SecurityReport | null>(null);
  const [preview, setPreview] = useState<ExecutionPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function resetTransientState(nextRequestId: string) {
    setRequestId(nextRequestId);
    setPhase("idle");
    setReason(null);
    setIntent(null);
    setRisk(null);
    setPreview(null);
    setErrorMessage(null);
  }

  function applyEvents(events: SIPRuntimeMessage[]) {
    for (const event of events) {
      if (event.type === "workflow.state.changed") {
        setPhase(event.payload.phase);
        setReason(event.payload.reason ?? null);
      }

      if (event.type === "intent.parse.succeeded") {
        setIntent(event.payload.intent);
      }

      if (event.type === "intent.parse.failed") {
        setErrorMessage(event.payload.reason);
      }

      if (event.type === "risk.scan.completed") {
        setRisk(event.payload.report);
      }

      if (event.type === "execution.preview.ready") {
        setPreview(event.payload);
      }

      if (event.type === "execution.preview.failed") {
        setErrorMessage(event.payload.reason);
      }
    }
  }

  async function submit(userInput: string) {
    const nextRequestId = createRequestId(requestSequence.current);
    requestSequence.current += 1;
    resetTransientState(nextRequestId);

    const events = await router.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: nextRequestId,
        tabId: 1,
        userInput,
        contextSnapshot: {
          tabId: 1,
          url: "https://example.com",
          title: "Example",
          detectedTokens: [],
          rawHints: [],
          detectedAt: new Date().toISOString()
        }
      }
    });

    applyEvents(events);
  }

  function confirmSignature() {
    if (!requestId) {
      return;
    }

    applyEvents(
      router.handleExecutionConfirmed({
        type: "execution.confirmed",
        payload: { requestId }
      } satisfies ExecutionConfirmedMessage)
    );
  }

  function cancelSignature() {
    if (!requestId) {
      return;
    }

    applyEvents(
      router.handleExecutionCancelled({
        type: "execution.cancelled",
        payload: { requestId }
      } satisfies ExecutionCancelledMessage)
    );
  }

  function failSubmission() {
    if (!requestId) {
      return;
    }

    applyEvents(
      router.handleTransactionFailed({
        type: "transaction.failed",
        payload: {
          requestId,
          reason: "Mock submission failed"
        }
      } satisfies TransactionFailedMessage)
    );
  }

  function settleTransaction() {
    if (!requestId) {
      return;
    }

    applyEvents(
      router.handleTransactionSettled({
        type: "transaction.settled",
        payload: {
          requestId,
          signature: "mock-signature",
          settledAt: new Date().toISOString()
        }
      } satisfies TransactionSettledMessage)
    );
  }

  return {
    requestId,
    phase,
    reason,
    intent,
    risk,
    preview,
    errorMessage,
    submit,
    confirmSignature,
    cancelSignature,
    failSubmission,
    settleTransaction
  };
}
