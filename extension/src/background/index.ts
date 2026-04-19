type ChromeSidePanelApi = {
  setPanelBehavior(options: { openPanelOnActionClick: boolean }): Promise<void> | void;
  open(options: { tabId: number }): Promise<void> | void;
};

type ChromeRuntimeApi = {
  onInstalled: {
    addListener(listener: () => void): void;
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
