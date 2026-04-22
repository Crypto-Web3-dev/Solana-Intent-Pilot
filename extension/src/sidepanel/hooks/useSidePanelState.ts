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

function createChromeRuntimeMessageRouter(): SidePanelMessageRouter {
  const send = async (message: SIPRuntimeMessage) => {
    return new Promise<SIPRuntimeMessage[]>((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || []);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  return {
    handleIntentRequest: send,
    handleExecutionConfirmed: send,
    handleExecutionCancelled: send,
    handleTransactionSubmitted: send,
    handleTransactionFailed: send,
    handleTransactionSettled: send
  } as SidePanelMessageRouter;
}

const isTest =
  typeof process !== "undefined" && process.env.NODE_ENV === "test";
const router = isTest
  ? createMessageRouter()
  : createChromeRuntimeMessageRouter();

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
  const [pageTabId, setPageTabId] = useState<number | null>(null);
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
    setPageTabId(null);
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

    // 在解析意图前尝试获取钱包地址
    const wallet = await detectWalletStatus(pageContext.tabId);

    const events = await messageRouter.handleIntentRequest({
      type: "intent.parse.requested",
      payload: {
        requestId: nextRequestId,
        tabId: pageContext.tabId,
        userInput,
        contextSnapshot: pageContext,
        userPublicKey: wallet.address
      }
    });

    if (!requestTracker.current.isCurrent(requestToken)) {
      return;
    }

    setPageTabId(pageContext.tabId);
    setWalletStatus(wallet.status);
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
      .then((res) => {
        if (!cancelled) {
          setWalletStatus(res.status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWalletStatus("unknown");
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
            preview,
            pageTabId ?? undefined
          );
          if (submission.outcome === "settled" && submission.signature) {
            setWalletStatus("submitted");

            // 提交到 Jupiter executeSwap 接口
            try {
              await messageRouter.handleTransactionSubmitted({
                type: "transaction.submitted",
                payload: {
                  requestId,
                  signature: submission.signature
                }
              });
            } catch (err) {
              console.error("Failed to execute swap on Jupiter:", err);
            }

            applyEvents(
              await messageRouter.handleTransactionSettled({
                type: "transaction.settled",
                payload: {
                  requestId,
                  signature: submission.signature,
                  settledAt: new Date().toISOString(),
                  explorerUrl: submission.explorerUrl
                }
              })
            );
            setIsSigning(false);
            return;
          }

          const failureReason = submission.error || (
            submission.outcome === "timeout"
              ? "Transaction submission timed out before confirmation."
              : "Wallet submission failed"
          );

          applyEvents(
            await messageRouter.handleTransactionFailed({
              type: "transaction.failed",
              payload: {
                requestId,
                reason: failureReason
              }
            })
          );
          setErrorMessage(failureReason);
          setWalletStatus("failed");
          setIsSigning(false);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Wallet submission failed";

          const isBlocked = message.includes("normal web pages");

          if (isBlocked) {
            setPhase("blocked");
            setReason("unsupported-page");
          } else {
            applyEvents(
              await messageRouter.handleTransactionFailed({
                type: "transaction.failed",
                payload: {
                  requestId,
                  reason: message
                }
              })
            );
          }

          setErrorMessage(message);
          setWalletStatus(
            message.includes("Wallet provider not available")
              ? "provider-missing"
              : isBlocked
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

    void messageRouter
      .handleExecutionCancelled({
        type: "execution.cancelled",
        payload: { requestId }
      } satisfies ExecutionCancelledMessage)
      .then((events) => {
        applyEvents(events);
        setIsSigning(false);
      });
  }

  function failSubmission() {
    if (!requestId) {
      return;
    }

    void messageRouter
      .handleTransactionFailed({
        type: "transaction.failed",
        payload: {
          requestId,
          reason: "Mock submission failed"
        }
      } satisfies TransactionFailedMessage)
      .then((events) => {
        applyEvents(events);
        setWalletStatus("failed");
        setIsSigning(false);
      });
  }

  function settleTransaction() {
    if (!requestId) {
      return;
    }

    void messageRouter
      .handleTransactionSettled({
        type: "transaction.settled",
        payload: {
          requestId,
          signature: "mock-signature",
          settledAt: new Date().toISOString()
        }
      } satisfies TransactionSettledMessage)
      .then((events) => {
        applyEvents(events);
        setIsSigning(false);
      });
  }

  function openNormalPage() {
    if (typeof window === "undefined") {
      return;
    }

    window.open("https://example.com", "_blank", "noopener,noreferrer");
  }

  return {
    requestId,
    pageTabId,
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
