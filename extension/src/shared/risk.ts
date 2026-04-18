export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface SecurityCheck {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface SecurityReport {
  score: number;
  level: RiskLevel;
  blocking: boolean;
  checks: SecurityCheck[];
  summary: string;
}
