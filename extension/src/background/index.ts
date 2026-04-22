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

// --- 核心业务流初始化 ---

// 根据环境变量使用生产服务，如果没有配置环境变量则回退到 Mock 服务
const useMock = !process.env.JUPITER_API_BASE && !process.env.OPENAI_API_KEY;

const services = useMock
  ? createMockRuntimeServices()
  : createProductionRuntimeServices({
      jupiterBaseUrl: process.env.JUPITER_API_BASE
    });

const router = createMessageRouter(undefined, services);

// 监听并处理来自 UI 的消息
chromeApi?.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const req = message as SIPRuntimeMessage;
  
  if (!req || typeof req.type !== "string") {
    return false;
  }

  // 路由消息
  if (req.type === "intent.parse.requested") {
    router.handleIntentRequest(req).then(sendResponse).catch(console.error);
    return true; // 保持异步通道开启
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

