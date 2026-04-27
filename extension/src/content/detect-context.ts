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

function detectTokenHints(url: string, text: string): TokenHint[] {
  const hints: TokenHint[] = [];
  
  // 1. Solana 地址识别 (Base58, 32-44 bytes)
  const addressRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
  const addresses = text.match(addressRegex) || [];
  
  // 2. $TICKER 识别
  const tickerRegex = /\$[A-Z]{2,10}\b/g;
  const tickers = text.match(tickerRegex) || [];

  const source = url.includes("x.com") ? "twitter" : (url.includes("dexscreener") ? "dexscreener" : "generic");

  Array.from(new Set(addresses)).forEach(addr => {
      hints.push({ mint: addr, source, confidence: 0.95 });
  });

  Array.from(new Set(tickers)).forEach(t => {
      hints.push({ symbol: t.replace("$", ""), source, confidence: 0.85 });
  });

  return hints.slice(0, 5); // 限制返回数量，防止干扰
}

function extractRawHints(): string[] {
  const hints: string[] = [];
  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute("content");
  if (metaDesc) hints.push(metaDesc.substring(0, 100));

  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (ogTitle) hints.push(ogTitle);

  return hints;
}

export function captureContext(): any {
  const bodyText = document.body?.innerText || "";
  // 性能：只扫描前 5000 字符
  const sampleText = bodyText.substring(0, 5000);

  const hints = detectTokenHints(window.location.href, sampleText);
  const selectedText = getSelectedText();
  const rawHints = extractRawHints();

  return {
    payload: {
        selectedText: selectedText || undefined,
        detectedTokens: hints,
        rawHints: rawHints
    }
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
