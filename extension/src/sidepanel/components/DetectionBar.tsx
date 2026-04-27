import React from "react";
import type { WorkflowPhase } from "../../shared/workflow";

const phases: { id: WorkflowPhase; label: string; icon: string; color: string }[] = [
  { id: "parsing", label: "AI Analysis", icon: "🧠", color: "#38bdf8" },
  { id: "risk-checking", label: "Security Scan", icon: "🛡️", color: "#fbbf24" },
  { id: "quoting", label: "Route Finding", icon: "⚡", color: "#38bdf8" },
  { id: "simulating", label: "Simulating", icon: "🔮", color: "#a855f7" },
  { id: "awaiting-signature", label: "Reviewing", icon: "📝", color: "#10b981" },
];

export function DetectionBar({ phase }: { phase: WorkflowPhase }) {
  if (phase === "idle") return null;

  const currentIdx = phases.findIndex((p) => p.id === phase);
  const activePhase = phases[currentIdx] || phases[0];

  return (
    <div style={{ margin: "12px 0", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="animate-scan" style={{ 
            width: 8, height: 8, borderRadius: "50%", background: activePhase.color 
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: activePhase.color, letterSpacing: '0.02em' }} className="text-blink">
            {activePhase.icon} {activePhase.label.toUpperCase()}...
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>
          {currentIdx >= 0 ? Math.round(((currentIdx + 1) / phases.length) * 100) : 0}%
        </span>
      </div>

      <div style={{ 
        height: 4, width: "100%", background: "rgba(255,255,255,0.05)", 
        borderRadius: 2, overflow: "hidden", position: 'relative' 
      }}>
        <div 
          style={{ 
            height: "100%", 
            width: `${currentIdx >= 0 ? ((currentIdx + 1) / phases.length) * 100 : 0}%`, 
            background: activePhase.color,
            transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: `0 0 8px ${activePhase.color}`
          }} 
        />
        {/* 流光特效 */}
        <div className="animate-flow" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      </div>
    </div>
  );
}
