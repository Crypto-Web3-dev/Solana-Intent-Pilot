import type { DetectedContextSnapshot, TokenHint } from "../shared/context";

const MAX_BODY_TEXT_CHARS = 600;
const MAX_SELECTED_TEXT_CHARS = 120;
const MAX_RAW_HINTS = 2;
const MAX_RAW_HINT_CHARS = 80;
const MAX_TEXT_ADDRESSES = 2;
const MAX_TEXT_TICKERS = 2;
const MAX_DETECTED_TOKENS = 8;

export function registerWalletBridge() {
  console.log("[SIP] Wallet Bridge Registered in Content Script");
}

function normalizeText(value: string, maxChars: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function getSelectedText(): string {
  if (typeof window === "undefined") return "";
  return normalizeText(window.getSelection()?.toString() ?? "", MAX_SELECTED_TEXT_CHARS);
}

function detectSource(url: string): TokenHint["source"] {
  if (url.includes("x.com") || url.includes("twitter.com")) return "twitter";
  if (url.includes("dexscreener")) return "dexscreener";
  return "generic";
}

function pushUniqueHint(hints: TokenHint[], hint: TokenHint) {
  const key = hint.mint ? `mint:${hint.mint}` : hint.symbol ? `symbol:${hint.symbol}` : "";
  if (!key) return;

  const existing = hints.find((candidate) =>
    hint.mint ? candidate.mint === hint.mint : candidate.symbol === hint.symbol
  );

  if (!existing) {
    hints.push(hint);
  }
}

function detectPumpFunMint(url: string): string | null {
  return url.match(/pump\.fun\/coin\/([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1] ?? null;
}

function detectLinkMints(): string[] {
  const links = Array.from(document.querySelectorAll?.("a[href]") ?? []);
  return links
    .map((link) => link.getAttribute("href") ?? "")
    .map((href) => href.match(/\/(?:token|coin)\/([1-9A-HJ-NP-Za-km-z]{32,44})/)?.[1])
    .filter((mint): mint is string => Boolean(mint))
    .slice(0, MAX_TEXT_ADDRESSES);
}

function detectSelectedSymbol(selectedText: string): string | null {
  const trimmed = selectedText.trim();
  const cashtag = trimmed.match(/^\$([A-Z]{2,10})$/)?.[1];
  if (cashtag) return cashtag;

  return /^[A-Z][A-Z0-9]{1,9}$/.test(trimmed) ? trimmed : null;
}

function detectTokenHints(url: string, text: string, selectedText: string): TokenHint[] {
  const hints: TokenHint[] = [];
  const source = detectSource(url);

  const pumpMint = detectPumpFunMint(url);
  if (pumpMint) {
    pushUniqueHint(hints, { mint: pumpMint, source, confidence: 0.96 });
  }

  detectLinkMints().forEach((mint) => {
    pushUniqueHint(hints, { mint, source, confidence: 0.74 });
  });

  const selectedSymbol = detectSelectedSymbol(selectedText);
  if (selectedSymbol) {
    pushUniqueHint(hints, { symbol: selectedSymbol, source, confidence: 0.9 });
  }

  const addressRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const addresses = Array.from(new Set(text.match(addressRegex) || [])).slice(0, MAX_TEXT_ADDRESSES);

  const tickerRegex = /\$[A-Z]{2,10}\b/g;
  const tickers = Array.from(new Set(text.match(tickerRegex) || [])).slice(0, MAX_TEXT_TICKERS);

  addresses.forEach((mint) => {
    pushUniqueHint(hints, { mint, source, confidence: 0.74 });
  });

  tickers.forEach((ticker) => {
    pushUniqueHint(hints, { symbol: ticker.replace("$", ""), source, confidence: 0.82 });
  });

  if (source === "generic") {
    const commonSymbols = Array.from(new Set(text.match(/\b(USDC|USDT|PUMP|JUP|BONK|WIF)\b/g) || []));
    commonSymbols.forEach((symbol) => {
      pushUniqueHint(hints, { symbol, source, confidence: 0.76 });
    });
  }

  return hints.slice(0, MAX_DETECTED_TOKENS);
}

function extractRawHints(): string[] {
  const hints = [
    document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? ""
  ]
    .map((value) => normalizeText(value, MAX_RAW_HINT_CHARS))
    .filter(Boolean)
    .slice(0, MAX_RAW_HINTS);

  return hints;
}

export function captureContext(): DetectedContextSnapshot & { payload: DetectedContextSnapshot } {
  const bodyText = normalizeText(document.body?.innerText || "", MAX_BODY_TEXT_CHARS);
  const selectedText = getSelectedText();
  const snapshot: DetectedContextSnapshot = {
    selectedText: selectedText || undefined,
    detectedTokens: detectTokenHints(window.location.href, bodyText, selectedText),
    rawHints: extractRawHints(),
    detectedAt: new Date().toISOString()
  };

  return {
    ...snapshot,
    payload: snapshot
  };
}

export function createContextDetectedMessage() {
  const { payload } = captureContext();
  return {
    type: "context.detected",
    payload
  };
}

function isTrustedSender(sender: { id?: string } | undefined) {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    return true;
  }

  return !sender?.id || sender.id === chrome.runtime.id;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedSender(sender)) {
      return false;
    }

    if (
      message?.type === "context.request_scan" ||
      message?.type === "context.snapshot.requested"
    ) {
      sendResponse(captureContext());
    }

    return true;
  });
}

registerWalletBridge();
