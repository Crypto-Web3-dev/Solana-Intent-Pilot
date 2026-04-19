export type WalletStatus =
  | "unknown"
  | "checking"
  | "ready"
  | "provider-missing"
  | "unsupported-page"
  | "connecting"
  | "submitted"
  | "failed";
