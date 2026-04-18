import type { DetectedContextSnapshot } from "../shared/context";
import type { ContextDetectedMessage } from "../shared/messages";

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
