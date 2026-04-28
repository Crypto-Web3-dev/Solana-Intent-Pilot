import type { DetectedContextSnapshot, TokenHint } from "../shared/context";

/**
 * 增强型环境雷达 (Context Radar) + 钱包桥接注册
 * 负责在用户浏览任何页面时，静默提取高价值的代币线索
 */

export function registerWalletBridge() {
  console.log("[SIP] Wallet Bridge Registered in Content Script");
}

function getSelectedText(): string {
  if (typeof window === "undefined") return "";
  return window.getSelection()?.toString().trim() || "";
}

function detectSource(url: string): TokenHint["source"] {
  if (url.includes("x.com")) return "twitter";
  if (url.includes("dexscreener")) return "dexscreener";
  return "generic";
}

function pushUniqueHint(hints: TokenHint[], hint: TokenHint) {
  const key = hint.mint ? `mint:${hint.mint}` : hint.symbol ? `symbol:${hint.symbol}` : "";
  if (!key) return;

  const existing = hints.find((candidate) =>
    hint.mint
      ? candidate.mint === hint.mint
      : candidate.symbol === hint.symbol
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
    .filter((mint): mint is string => Boolean(mint));
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
  const addresses = text.match(addressRegex) || [];

  const tickerRegex = /\$[A-Z]{2,10}\b/g;
  const tickers = text.match(tickerRegex) || [];

  Array.from(new Set(addresses)).forEach(addr => {
      pushUniqueHint(hints, { mint: addr, source, confidence: 0.74 });
  });

  Array.from(new Set(tickers)).forEach(t => {
      pushUniqueHint(hints, { symbol: t.replace("$", ""), source, confidence: 0.82 });
  });

  if (source === "generic") {
    const commonSymbols = text.match(/\b(USDC|USDT|PUMP|JUP|BONK|WIF)\b/g) || [];
    Array.from(new Set(commonSymbols)).forEach((symbol) => {
      pushUniqueHint(hints, { symbol, source, confidence: 0.76 });
    });
  }

  return hints.slice(0, 8);
}

function extractRawHints(): string[] {
  const hints: string[] = [];
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
  if (metaDesc) hints.push(`Desc: ${metaDesc.substring(0, 100)}`);

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (ogTitle) hints.push(ogTitle);

  return hints;
}

export function captureContext(): any {
  const bodyText = document.body?.innerText || "";
  const sampleText = bodyText.substring(0, 5000);
  const selectedText = getSelectedText();
  const hints = detectTokenHints(window.location.href, sampleText, selectedText);
  const rawHints = extractRawHints();

  const snapshot = {
    selectedText: selectedText || undefined,
    detectedTokens: hints,
    rawHints,
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

// 监听来自侧边栏的请求
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // 统一消息类型名
    if (message.type === "context.request_scan" || message.type === "context.snapshot.requested") {
      sendResponse(captureContext());
    }
    return true;
  });
}

registerWalletBridge();
