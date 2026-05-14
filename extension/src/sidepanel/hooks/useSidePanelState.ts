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
    handleTransactionSettled: send,
    handleCancelRequested: send,
    handleRetryRequested: send
  } as any;
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

type SidePanelMessageRouter = any;

const SUPPORTED_PAGE_MESSAGE =
  "Open a supported page like Jupiter, pump.fun, X, DexScreener, Solscan, or Raydium before submitting.";

export function useSidePanelState(
  messageRouter: SidePanelMessageRouter = router
) {
  const requestSequence = useRef(1);
  const requestTracker = useRef(createRequestTracker());
  const requestIdRef = useRef<string | null>(null);

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
    requestIdRef.current = nextRequestId;
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

  useEffect(() => {
    if (isTest) return;

    const listener = (
      message: SIPRuntimeMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      if ("payload" in message && "requestId" in message.payload) {
        if (message.payload.requestId === requestIdRef.current) {
          applyEvents([message]);
        }
      }

      sendResponse({ received: true });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  async function submit(userInput: string) {
    const nextRequestId = createRequestId(requestSequence.current);
    const requestToken = requestTracker.current.next();
    requestSequence.current += 1;
    resetTransientState(nextRequestId);
    const pageContext = await getCurrentPageContext();

    if (!pageContext) {
      setPhase("blocked");
      setReason("unsupported-page");
      setErrorMessage(SUPPORTED_PAGE_MESSAGE);
      setWalletStatus("unsupported-page");
      return;
    }

    const wallet = await detectWalletStatus(pageContext.tabId);
    setPageTabId(pageContext.tabId);
    setWalletStatus(wallet.status);

    if (!wallet.address) {
      setPhase("blocked");
      setReason("wallet-public-key-missing");
      setErrorMessage("Connect your Solana wallet before requesting a live Jupiter order.");
      return;
    }

    void (messageRouter as any)
      .handleIntentRequest({
        type: "intent.parse.requested",
        payload: {
          requestId: nextRequestId,
          tabId: pageContext.tabId,
          userInput,
          contextSnapshot: pageContext,
          userPublicKey: wallet.address
        }
      })
      .then((events: any) => {
        if (requestTracker.current.isCurrent(requestToken)) {
          applyEvents(events || []);
        }
      });

    if (!requestTracker.current.isCurrent(requestToken)) {
      return;
    }
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
    if (!requestId) return;

    const currentIntent = intent;
    const currentPreview = preview;

    setIsSigning(true);
    setWalletStatus("connecting");

    void (messageRouter as any)
      .handleExecutionConfirmed({
        type: "execution.confirmed",
        payload: { requestId }
      })
      .then(async (events: any) => {
        applyEvents(events || []);

        if (!currentIntent || !currentPreview) {
          console.error("[SidePanel] Missing data for signature.");
          return;
        }

        if (currentPreview.swapTransaction?.includes("mock-tx")) {
          setWalletStatus("submitted");
          setTimeout(() => settleTransaction(), 1000);
          return;
        }

        try {
          const submission = await submitWithLifecycle(
            requestId,
            currentIntent,
            currentPreview,
            pageTabId ?? undefined
          );
          if (submission.outcome === "settled" && submission.signature) {
            setWalletStatus("submitted");
            try {
              await (messageRouter as any).handleTransactionSubmitted({
                type: "transaction.submitted",
                payload: { requestId, signature: submission.signature }
              });
            } catch (err) {
              console.error("Jupiter sync failed:", err);
            }

            applyEvents(
              await (messageRouter as any).handleTransactionSettled({
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

          const failureReason =
            submission.error ||
            (submission.outcome === "timeout" ? "Timed out" : "Wallet failed");
          applyEvents(
            await (messageRouter as any).handleTransactionFailed({
              type: "transaction.failed",
              payload: { requestId, reason: failureReason }
            })
          );
          setErrorMessage(failureReason);
          setWalletStatus("failed");
          setIsSigning(false);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed";
          const isBlocked =
            message.includes("supported pages") ||
            message.includes("supported page") ||
            message.includes("Jupiter, pump.fun, X, DexScreener, Solscan, or Raydium");
          if (isBlocked) {
            setPhase("blocked");
            setReason("unsupported-page");
            setErrorMessage(SUPPORTED_PAGE_MESSAGE);
          } else {
            applyEvents(
              await (messageRouter as any).handleTransactionFailed({
                type: "transaction.failed",
                payload: { requestId, reason: message }
              })
            );
            setErrorMessage(message);
          }
          setWalletStatus(
            message.includes("Wallet provider")
              ? "provider-missing"
              : isBlocked
                ? "unsupported-page"
                : "failed"
          );
          setIsSigning(false);
        }
      });
  }

  function retrySignature() {
    if (!requestId) return;
    setErrorMessage(null);
    void (messageRouter as any)
      .handleRetryRequested({
        type: "execution.retry_requested",
        payload: { requestId }
      })
      .then((events: any) => {
        applyEvents(events || []);
        confirmSignature();
      });
  }

  function cancelSignature() {
    cancelProcessing();
  }

  function failSubmission() {
    if (!requestId) return;
    void (messageRouter as any)
      .handleTransactionFailed({
        type: "transaction.failed",
        payload: { requestId, reason: "Mock failed" }
      })
      .then((events: any) => {
        applyEvents(events || []);
        setWalletStatus("failed");
        setIsSigning(false);
      });
  }

  function settleTransaction() {
    if (!requestId) return;
    void (messageRouter as any)
      .handleTransactionSettled({
        type: "transaction.settled",
        payload: {
          requestId,
          signature: "mock-signature",
          settledAt: new Date().toISOString()
        }
      })
      .then((events: any) => {
        applyEvents(events || []);
        setIsSigning(false);
      });
  }

  function cancelProcessing() {
    if (requestId) {
      void chrome.runtime.sendMessage({
        type: "execution.cancel_requested",
        payload: { requestId }
      });
    }

    requestTracker.current.next();
    const nextRequestId = createRequestId(requestSequence.current);
    requestSequence.current += 1;
    resetTransientState(nextRequestId);
  }

  function openNormalPage() {
    if (typeof window !== "undefined")
      window.open("https://jup.ag", "_blank", "noopener,noreferrer");
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
    openNormalPage,
    cancelProcessing,
    retrySignature
  };
}
