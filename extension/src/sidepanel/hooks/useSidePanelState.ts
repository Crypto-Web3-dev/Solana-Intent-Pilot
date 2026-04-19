import { useEffect, useRef, useState } from "react";
import { createMessageRouter } from "../../background/message-router";
import type { ExecutionPreview } from "../../shared/execution";
import type { ClarificationPayload, SIPIntent } from "../../shared/intent";
import type {
  ExecutionCancelledMessage,
  ExecutionConfirmedMessage,
  SIPRuntimeMessage,
  TransactionFailedMessage,
  TransactionSettledMessage
} from "../../shared/messages";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase, WorkflowReason } from "../../shared/workflow";
import {
  detectWalletStatus,
  submitWithLifecycle
} from "../wallet-bridge";
import { getCurrentPageContext } from "../page-context";
import type { WalletStatus } from "../wallet-state";

const router = createMessageRouter();

export function createRequestTracker() {
  let latestToken = 0;

  return {
    next() {
      latestToken += 1;

      return latestToken;
    },
    isCurrent(token: number) {
      return token === latestToken;
    }
  };
}

function createRequestId(sequence: number) {
  return `req-ui-${sequence}`;
}

type SidePanelMessageRouter = typeof router;

export function useSidePanelState(
  messageRouter: SidePanelMessageRouter = router
) {
  const requestSequence = useRef(1);
  const requestTracker = useRef(createRequestTracker());
  const [requestId, setRequestId] = useState<string | null>(null);
  const [phase, setPhase] = useState<WorkflowPhase>("idle");
  const [reason, setReason] = useState<WorkflowReason | string | null>(null);
  const [intent, setIntent] = useState<SIPIntent | null>(null);
  const [clarification, setClarification] = useState<ClarificationPayload | null>(
    null
  );
  const [risk, setRisk] = useState<SecurityReport | null>(null);
  const [preview, setPreview] = useState<ExecutionPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("unknown");
  const [isSigning, setIsSigning] = useState(false);

  function resetTransientState(nextRequestId: string) {
    setRequestId(nextRequestId);
    setPhase("idle");
    setReason(null);
    setIntent(null);
    setRisk(null);
    setPreview(null);
    setErrorMessage(null);
    setWalletStatus("unknown");
    setIsSigning(false);
    setClarification(null);
  }

  function applyEvents(events: SIPRuntimeMessage[]) {
    for (const event of events) {
      if (event.type === "workflow.state.changed") {
        setPhase(event.payload.phase);
        setReason(event.payload.reason ?? null);
      }

      if (event.type === "intent.parse.succeeded") {
        setIntent(event.payload.intent);
        setClarification(event.payload.intent.metadata.clarification ?? null);
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
    const requestToken = requestTracker.current.next();
    requestSequence.current += 1;
    resetTransientState(nextRequestId);
    const pageContext = await getCurrentPageContext();

    if (!pageContext) {
      setPhase("blocked");
      setReason("unsupported-page");
      setErrorMessage(
        "A normal webpage is required before SIP can parse the current context."
      );
      setWalletStatus("unsupported-page");
      return;
    }

    const events = await messageRouter.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: nextRequestId,
        tabId: pageContext.tabId,
        userInput,
        contextSnapshot: pageContext
      }
    });

    if (!requestTracker.current.isCurrent(requestToken)) {
      return;
    }

    applyEvents(events);
  }

  useEffect(() => {
    if (phase !== "awaiting-signature") {
      if (phase !== "submitting" && phase !== "confirmed") {
        setIsSigning(false);
      }

      return;
    }

    let cancelled = false;
    setWalletStatus("checking");

    void detectWalletStatus()
      .then((status) => {
        if (!cancelled) {
          setWalletStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWalletStatus("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [phase]);

  function confirmSignature() {
    if (!requestId) {
      return;
    }

    setIsSigning(true);
    setWalletStatus("connecting");

    void messageRouter
      .handleExecutionConfirmed({
        type: "execution.confirmed",
        payload: { requestId }
      } satisfies ExecutionConfirmedMessage)
      .then(async (events) => {
        applyEvents(events);

        if (!intent || !preview) {
          return;
        }

        try {
          const submission = await submitWithLifecycle(
            requestId,
            intent,
            preview
          );
          if (submission.outcome === "settled" && submission.signature) {
            setWalletStatus("submitted");

            applyEvents(
              messageRouter.handleTransactionSubmitted({
                type: "transaction.submitted",
                payload: {
                  requestId,
                  signature: submission.signature
                }
              })
            );

            applyEvents(
              messageRouter.handleTransactionSettled({
                type: "transaction.settled",
                payload: {
                  requestId,
                  signature: submission.signature,
                  settledAt: new Date().toISOString(),
                  explorerUrl: submission.explorerUrl
                }
              })
            );

            return;
          }

          setPhase("failed");
          setReason("submit-failed");
          setErrorMessage(
            submission.outcome === "timeout"
              ? "Transaction submission timed out before confirmation."
              : "Wallet submission failed"
          );
          setWalletStatus("failed");
          setIsSigning(false);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Wallet submission failed";

          setPhase(
            message.includes("normal web pages") ? "blocked" : "failed"
          );
          setReason(
            message.includes("normal web pages")
              ? "unsupported-page"
              : "submit-failed"
          );
          setErrorMessage(message);
          setWalletStatus(
            message.includes("Wallet provider not available")
              ? "provider-missing"
              : message.includes("normal web pages")
                ? "unsupported-page"
                : "failed"
          );
          setIsSigning(false);
        }
      });
  }

  function cancelSignature() {
    if (!requestId) {
      return;
    }

    applyEvents(
      messageRouter.handleExecutionCancelled({
        type: "execution.cancelled",
        payload: { requestId }
      } satisfies ExecutionCancelledMessage)
    );
    setIsSigning(false);
  }

  function failSubmission() {
    if (!requestId) {
      return;
    }

    applyEvents(
      messageRouter.handleTransactionFailed({
        type: "transaction.failed",
        payload: {
          requestId,
          reason: "Mock submission failed"
        }
      } satisfies TransactionFailedMessage)
    );
    setWalletStatus("failed");
    setIsSigning(false);
  }

  function settleTransaction() {
    if (!requestId) {
      return;
    }

    applyEvents(
      messageRouter.handleTransactionSettled({
        type: "transaction.settled",
        payload: {
          requestId,
          signature: "mock-signature",
          settledAt: new Date().toISOString()
        }
      } satisfies TransactionSettledMessage)
    );
    setIsSigning(false);
  }

  function openNormalPage() {
    if (typeof window === "undefined") {
      return;
    }

    window.open("https://example.com", "_blank", "noopener,noreferrer");
  }

  return {
    requestId,
    phase,
    reason,
    intent,
    clarification,
    risk,
    preview,
    errorMessage,
    walletStatus,
    isSigning,
    submit,
    confirmSignature,
    cancelSignature,
    failSubmission,
    settleTransaction,
    openNormalPage
  };
}
