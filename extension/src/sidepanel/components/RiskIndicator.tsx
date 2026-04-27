import React from "react";
import type { SecurityReport } from "../../shared/risk";
import type { WorkflowPhase } from "../../shared/workflow";

export function RiskIndicator({ 
  risk, 
  phase 
}: { 
  risk: SecurityReport | null;
  phase: WorkflowPhase;
}) {
  const isScanning = phase === "risk-checking" || (!risk && phase !== "failed");

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
            background: isScanning ? 'rgba(56, 189, 248, 0.1)' : (risk?.blocking ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
          }}>
            {isScanning ? "🛰️" : (risk?.blocking ? "🚫" : "🛡️")}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Security Engine
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: isScanning ? '#38bdf8' : (risk?.blocking ? '#f87171' : '#10b981') }}>
              {isScanning ? "Deep Scanning Protocols..." : (risk?.summary || "Policy Check Complete")}
            </div>
          </div>
        </div>
        
        {risk && !isScanning && (
          <div style={{ 
            padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
            background: risk.blocking ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: risk.blocking ? '#f87171' : '#10b981',
            border: `1px solid ${risk.blocking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
          }}>
            {risk.score}/100
          </div>
        )}
      </div>

      {!isScanning && risk?.checks && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {risk.checks.map((check, i) => (
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
