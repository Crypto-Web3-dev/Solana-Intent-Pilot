import type { DetectedContextSnapshot } from "../shared/context";
import type {
  ContextDetectedMessage,
  WalletSubmissionCompletedMessage,
  WalletSubmissionFailedMessage,
  WalletSubmissionRequestedMessage
} from "../shared/messages";

function readSelectedText() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const selectedText = window.getSelection?.()?.toString().trim();

  return selectedText ? selectedText : undefined;
}

function readDocumentTitle() {
  if (typeof document === "undefined" || !document.title) {
    return "Unknown Page";
  }

  return document.title;
}

function readLocationHref() {
  if (typeof window === "undefined" || !window.location.href) {
    return "https://example.com";
  }

  return window.location.href;
}

export function buildMockDetectedContext(): DetectedContextSnapshot {
  return {
    tabId: 1,
    url: readLocationHref(),
    title: readDocumentTitle(),
    selectedText: readSelectedText() ?? "buy this token",
    detectedTokens: [],
    rawHints: ["example"],
    detectedAt: new Date().toISOString()
  };
}

export function createContextDetectedMessage(): ContextDetectedMessage {
  return {
    type: "context.detected",
    payload: buildMockDetectedContext()
  };
}

type ChromeRuntimeLike = {
  onMessage?: {
    addListener(
      listener: (
        message:
          | WalletSubmissionRequestedMessage
          | { type: "context.snapshot.requested" },
        sender: unknown,
        sendResponse: (
          response:
            | ContextDetectedMessage
            | WalletSubmissionCompletedMessage
            | WalletSubmissionFailedMessage
            | undefined
        ) => void
      ) => boolean | void
    ): void;
  };
};

type ChromeApiLike = {
  runtime?: ChromeRuntimeLike;
};

type SolanaWallet = {
  connect?: () => Promise<void>;
  signAndSendTransaction?: (transaction: unknown) => Promise<{ signature: string }>;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
};

type WindowWithSolana = Window & {
  solana?: SolanaWallet;
};

async function handleWalletSubmission(
  message: WalletSubmissionRequestedMessage
): Promise<WalletSubmissionCompletedMessage | WalletSubmissionFailedMessage> {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SIP_SIGN_RES") {
        window.removeEventListener("message", handler);
        if (event.data.error) {
          resolve({
            type: "wallet.submission.failed",
            payload: { requestId: message.payload.requestId, reason: event.data.error }
          });
        } else {
          resolve({
            type: "wallet.submission.completed",
            payload: {
              requestId: message.payload.requestId,
              signature: event.data.result.signature,
              explorerUrl: `https://explorer.solana.com/tx/${event.data.result.signature}`
            }
          });
        }
      }
    };
    window.addEventListener("message", handler);
    window.postMessage({
      type: "SIP_SIGN_REQ",
      transaction: message.payload.preview.swapTransaction
    }, "*");
  });
}

export function registerWalletBridge() {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ChromeApiLike;
  }).chrome;

  chromeApi?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type === "context.snapshot.requested") {
      sendResponse(createContextDetectedMessage());
      return true;
    }

    return false;
  });
}
