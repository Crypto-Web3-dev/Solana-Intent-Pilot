import React from "react";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase } from "../../shared/workflow";

function formatRiskLevel(risk: SecurityReport | null) {
  return risk?.level ? risk.level.toUpperCase() : "";
}

function formatRiskSource(risk: SecurityReport | null) {
  if (!risk) return "";
  return risk.source === "wasm" ? "Wasm Rule Engine" : "Heuristic Policy";
}

function riskTone(risk: SecurityReport | null, isScanning: boolean) {
  if (isScanning) return "#38bdf8";
  if (risk?.blocking || risk?.level === "high") return "#f87171";
  if (risk?.level === "unknown" || risk?.level === "medium") return "#fbbf24";
  return "#10b981";
}

export function RiskIndicator({ 
  risk, 
  phase 
}: { 
  risk: SecurityReport | null;
  phase: WorkflowPhase;
}) {
  const isScanning = phase === "risk-checking" || (!risk && phase !== "failed");
  const tone = riskTone(risk, isScanning);
  const checks =
    risk?.level === "unknown" && risk.checks.length === 0
      ? [
          {
            key: "risk-data-incomplete",
            label: "Risk Data",
            status: "warn" as const,
            detail: "Current risk data is incomplete and not a verified safe result."
          }
        ]
      : risk?.checks;

  return (
    <div style={{ 
      padding: 14, 
      background: "rgba(15, 23, 42, 0.4)", 
      borderRadius: 16, 
      border: "1px solid rgba(255, 255, 255, 0.05)",
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 动态扫描射线 - 仅在扫描时显示 */}
      {isScanning && (
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '40%',
          background: 'linear-gradient(to bottom, transparent, rgba(56, 189, 248, 0.1), transparent)',
          zIndex: 1,
          pointerEvents: 'none',
          animation: 'scan-ray 2s infinite linear'
        }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 32, height: 32, borderRadius: 10, 
            background: isScanning ? 'rgba(56, 189, 248, 0.1)' : (risk?.blocking || risk?.level === "high" ? 'rgba(239, 68, 68, 0.1)' : risk?.level === "unknown" || risk?.level === "medium" ? 'rgba(251, 191, 36, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>
            {isScanning ? "🛰️" : (risk?.blocking || risk?.level === "high" ? "🚫" : risk?.level === "unknown" ? "⚠️" : "🛡️")}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Security Engine
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: tone }}>
              {isScanning ? "Deep Scanning Protocols..." : (risk?.summary || "Policy Check Complete")}
            </div>
            {risk && !isScanning && (
              <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                {formatRiskLevel(risk)} · {formatRiskSource(risk)}
              </div>
            )}
          </div>
        </div>
        
        {risk && !isScanning && (
          <div style={{ 
            padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
            background: risk.blocking || risk.level === "high" ? 'rgba(239, 68, 68, 0.1)' : risk.level === "unknown" || risk.level === "medium" ? 'rgba(251, 191, 36, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: tone,
            border: `1px solid ${risk.blocking || risk.level === "high" ? 'rgba(239, 68, 68, 0.2)' : risk.level === "unknown" || risk.level === "medium" ? 'rgba(251, 191, 36, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
          }}>
            {risk.score}/100
          </div>
        )}
      </div>

      {!isScanning && checks && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checks.map((check, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
              <span style={{ color: check.status === 'pass' ? '#10b981' : (check.status === 'fail' ? '#f87171' : '#fbbf24') }}>
                {check.status === 'pass' ? '●' : '▲'}
              </span>
              <span>{check.label}:</span>
              <span style={{ color: '#e2e8f0' }}>{check.detail}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
