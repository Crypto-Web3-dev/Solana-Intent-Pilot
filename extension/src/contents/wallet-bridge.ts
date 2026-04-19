import { registerWalletBridge } from "../content/detect-context";

registerWalletBridge();

export const config = {
  matches: ["<all_urls>"]
};
