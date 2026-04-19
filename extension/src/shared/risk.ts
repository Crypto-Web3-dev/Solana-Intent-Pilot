export type RiskLevel = "low" | "medium" | "high" | "unknown";
export type RiskEngineSource = "wasm" | "policy-fallback";

export interface SecurityCheck {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface SecurityReport {
  source: RiskEngineSource;
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: SecurityCheck[];
  summary: string;
}
