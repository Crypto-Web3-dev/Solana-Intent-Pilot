import { SUPPORTED_PAGE_MATCHES } from "../shared/supported-pages";

import { registerWalletBridge } from "../content/detect-context";

/**
 * Isolated World Content Script.
 * Responsible for the bridge between Chrome Runtime and the Page (window.postMessage).
 */
registerWalletBridge();

export const config = {
  matches: [
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
  ]
};
