import { registerWalletBridge } from "../content/detect-context";

/**
 * Isolated World Content Script.
 * Responsible for the bridge between Chrome Runtime and the Page (window.postMessage).
 */
registerWalletBridge();

export const config = {
  matches: ["<all_urls>"]
};
