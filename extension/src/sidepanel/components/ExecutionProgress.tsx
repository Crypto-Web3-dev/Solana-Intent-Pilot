import React from "react";
import type { WorkflowPhase } from "../../shared/workflow";

interface ExecutionProgressProps {
  phase: WorkflowPhase;
}

const STEPS = [
  { id: "parsing", label: "Parsing" },
  { id: "quoting", label: "Preparing Steps" },
  { id: "simulating", label: "Simulating Outcome" },
  { id: "awaiting-signature", label: "Waiting for Signature" },
  { id: "submitting", label: "Landing Bundle" }
];

export function ExecutionProgress({ phase }: ExecutionProgressProps) {
  let currentStepIndex = -1;
  if (phase === "parsing") currentStepIndex = 0;
  if (phase === "risk-checking" || phase === "quoting") currentStepIndex = 1;
  if (phase === "simulating") currentStepIndex = 2;
  if (phase === "awaiting-signature") currentStepIndex = 3;
  if (phase === "submitting" || phase === "confirmed") currentStepIndex = 4;

  const isBlocked = phase === "blocked";
  const isFailed = phase === "failed";
  const isIdle = phase === "idle";

  if (isIdle) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px 0" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
        Execution Progress
      </div>
      {STEPS.map((step, index) => {
        const isCompleted = index < currentStepIndex || (phase === "confirmed" && index === 4);
        const isActive = index === currentStepIndex && !isFailed;
        const isError = isFailed && index === currentStepIndex;

        let color = "#E0E0E0";
        if (isCompleted) color = "#4CAF50";
        if (isActive) color = "#2196F3";
        if (isError) color = "#F44336";

        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "16px",
                height: "16px",
                borderRadius: "50%",
                border: `2px solid ${color}`,
                background: isCompleted || isError ? color : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative"
              }}>
              {isCompleted && (
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div
              style={{
                fontSize: "14px",
                color: isActive || isCompleted || isError ? "#333" : "#999",
                fontWeight: isActive ? 600 : 400
              }}>
              {step.label}
            </div>
          </div>
        );
      })}
      {isBlocked && (
        <div style={{ marginTop: "8px", color: "#f59e0b", fontSize: "12px", fontWeight: 500 }}>
          Open a supported page to continue.
        </div>
      )}
      {isFailed && (
        <div style={{ marginTop: "8px", color: "#F44336", fontSize: "12px", fontWeight: 500 }}>
          Execution stopped due to an error or risk flag.
        </div>
      )}
    </div>
  );
}
