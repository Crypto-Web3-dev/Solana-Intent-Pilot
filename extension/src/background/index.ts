import { createMessageRouter } from "./message-router";
import { createProductionRuntimeServices, createMockRuntimeServices } from "./runtime-services";
import type { SIPRuntimeMessage } from "../shared/messages";

type ChromeSidePanelApi = {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void> | void;
  open(options: { tabId: number }): Promise<void> | void;
};

type ChromeRuntimeApi = {
  onInstalled: {
    addListener(listener: () => void): void;
  };
  onMessage: {
    addListener(
      listener: (
        message: any,
        sender: any,
        sendResponse: (response?: any) => void
      ) => boolean | void
    ): void;
  };
  sendMessage(message: any): Promise<any>;
};

type ChromeActionApi = {
  onClicked: {
    addListener(listener: (tab: { id?: number }) => void): void;
  };
};

type ChromeApi = {
  sidePanel?: ChromeSidePanelApi;
  runtime: ChromeRuntimeApi;
  action?: ChromeActionApi;
};

const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;

function enableActionClickOpensSidePanel() {
  if (!chromeApi?.sidePanel?.setPanelBehavior) {
    return;
  }

  chromeApi.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
}

function openSidePanelForTab(tabId?: number) {
  if (!chromeApi?.sidePanel?.open || tabId === undefined) {
    return;
  }

  void chromeApi.sidePanel.open({ tabId });
}

enableActionClickOpensSidePanel();

chromeApi?.runtime.onInstalled.addListener(() => {
  enableActionClickOpensSidePanel();
});

chromeApi?.action?.onClicked.addListener((tab) => {
  openSidePanelForTab(tab.id);
});

// --- Service Initialization ---
const useMockRuntime = process.env.NODE_ENV === "test";

if (useMockRuntime) {
  console.warn("Using mock runtime services in test mode.");
}

const services = useMockRuntime
  ? createMockRuntimeServices()
  : createProductionRuntimeServices({
      jupiterBaseUrl: process.env.JUPITER_API_BASE,
      jupiterApiKey: process.env.PLASMO_PUBLIC_JUPITER_API_KEY,
      rpcUrl: process.env.PLASMO_PUBLIC_SOLANA_RPC_URL
    });

// 核心优化：在创建 Router 时注入广播回调，利用 chrome.runtime.sendMessage 推送实时事件
const router = createMessageRouter(undefined, services, (event) => {
  chromeApi?.runtime.sendMessage(event).catch(() => {
    // 静默忽略没有监听者的消息推送
  });
});

// --- Message Handling ---
chromeApi?.runtime.onMessage.addListener((message, _sender, sendResponse) => {  
  const req = message as SIPRuntimeMessage;

  if (!req || typeof req.type !== "string") {
    return false;
  }

  if (req.type === "intent.parse.requested") {
    router.handleIntentRequest(req).then(sendResponse).catch(error => {
        console.error("Router error:", error);
        sendResponse([]);
    });
    return true;
  }

  if (req.type === "execution.cancel_requested") {
    sendResponse(router.handleCancelRequested(req));
    return false;
  }

  // 新增：处理签名重试请求
  if (req.type === "execution.retry_requested") {
    sendResponse(router.handleRetryRequested(req));
    return false;
  }

  if (req.type === "execution.confirmed") {
    router.handleExecutionConfirmed(req).then(sendResponse).catch(console.error);
    return true;
  }

  if (req.type === "execution.cancelled") {
    sendResponse(router.handleExecutionCancelled(req));
    return false;
  }

  if (req.type === "transaction.submitted") {
    sendResponse(router.handleTransactionSubmitted(req));
    return false;
  }

  if (req.type === "transaction.failed") {
    sendResponse(router.handleTransactionFailed(req));
    return false;
  }

  if (req.type === "transaction.settled") {
    sendResponse(router.handleTransactionSettled(req));
    return false;
  }

  return false;
});
