export const WORKFLOW_PHASES = [
  "idle",
  "detecting",
  "parsing",
  "risk-checking",
  "quoting",
  "simulating",
  "awaiting-signature",
  "submitting",
  "confirmed",
  "failed",
  "blocked"
] as const;

export type WorkflowPhase = (typeof WORKFLOW_PHASES)[number];

export const WORKFLOW_REASONS = [
  "context-refresh",
  "intent-invalid",
  "clarification-required",
  "risk-blocked",
  "risk-check-failed",
  "quote-failed",
  "simulation-failed",
  "unsupported-page",
  "signature-cancelled",
  "submit-failed",
  "confirmed"
] as const;

export type WorkflowReason = (typeof WORKFLOW_REASONS)[number];
