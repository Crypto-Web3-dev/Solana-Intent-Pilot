export const SUPPORTED_PAGE_MATCHES = [
  "https://jup.ag/*",
  "https://*.jup.ag/*",
  "https://pump.fun/*",
  "https://*.pump.fun/*",
  "https://x.com/*",
  "https://*.x.com/*",
  "https://twitter.com/*",
  "https://*.twitter.com/*",
  "https://dexscreener.com/*",
  "https://*.dexscreener.com/*",
  "https://solscan.io/*",
  "https://*.solscan.io/*",
  "https://raydium.io/*",
  "https://*.raydium.io/*"
] as const;

function escapeRegex(value: string) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function matchPatternToRegex(pattern: string) {
  const normalized = escapeRegex(pattern).replace(/\*/g, ".*");
  return new RegExp(`^${normalized}$`, "i");
}

export const SUPPORTED_PAGE_REGEXES = SUPPORTED_PAGE_MATCHES.map(matchPatternToRegex);

function normalizeUrlForMatch(url: string) {
  return /^https?:\/\/[^/]+$/i.test(url) ? `${url}/` : url;
}

export function isSupportedPageUrl(url?: string) {
  if (!url) {
    return false;
  }

  const normalizedUrl = normalizeUrlForMatch(url);
  return SUPPORTED_PAGE_REGEXES.some((pattern) => pattern.test(normalizedUrl));
}
