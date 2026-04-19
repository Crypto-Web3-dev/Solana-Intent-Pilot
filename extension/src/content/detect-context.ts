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
        message: WalletSubmissionRequestedMessage,
        sender: unknown,
        sendResponse: (
          response:
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
  const windowWithSolana = globalThis.window as WindowWithSolana | undefined;
  const solana = windowWithSolana?.solana;

  if (!solana) {
    return {
      type: "wallet.submission.failed",
      payload: {
        requestId: message.payload.requestId,
        reason: "Wallet provider not available in page context"
      }
    };
  }

  try {
    if (typeof solana.connect === "function") {
      await solana.connect();
    }

    if (typeof solana.signAndSendTransaction === "function") {
      const signed = await solana.signAndSendTransaction({});

      return {
        type: "wallet.submission.completed",
        payload: {
          requestId: message.payload.requestId,
          signature: signed.signature,
          explorerUrl: `https://explorer.solana.com/tx/${signed.signature}`
        }
      };
    }

    if (typeof solana.signTransaction === "function") {
      await solana.signTransaction({});

      return {
        type: "wallet.submission.completed",
        payload: {
          requestId: message.payload.requestId,
          signature: `signed-${message.payload.requestId}`,
          explorerUrl: `https://explorer.solana.com/tx/signed-${message.payload.requestId}`
        }
      };
    }

    return {
      type: "wallet.submission.failed",
      payload: {
        requestId: message.payload.requestId,
        reason: "No compatible wallet signing method found"
      }
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Wallet submission failed";

    return {
      type: "wallet.submission.failed",
      payload: {
        requestId: message.payload.requestId,
        reason
      }
    };
  }
}

export function registerWalletBridge() {
  const chromeApi = (globalThis as typeof globalThis & {
    chrome?: ChromeApiLike;
  }).chrome;

  chromeApi?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "wallet.submission.requested") {
      return;
    }

    void handleWalletSubmission(message).then((response) => sendResponse(response));
    return true;
  });
}
