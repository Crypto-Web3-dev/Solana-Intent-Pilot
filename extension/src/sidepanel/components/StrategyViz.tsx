import React from "react";
import type { SIPAction } from "../../shared/intent";

interface StrategyVizProps {
  actions: SIPAction[];
  currentActionId?: string;
}

export const StrategyViz: React.FC<StrategyVizProps> = ({ actions, currentActionId }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '16px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      margin: '12px 0'
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        Execution Pipeline
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {actions.map((action, index) => {
          const isActive = action.id === currentActionId;
          const isDone = action.status === 'ready';
          
          return (
            <div key={action.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', position: 'relative' }}>
              {/* Connector Line */}
              {index < actions.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: '11px',
                  top: '24px',
                  bottom: '-12px',
                  width: '2px',
                  background: isDone ? '#10b981' : 'rgba(255, 255, 255, 0.1)',  
                  zIndex: 0
                }} />
              )}

              {/* Status Indicator */}
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: isDone ? '#10b981' : (isActive ? 'rgba(56, 189, 248, 0.2)' : '#1e293b'),
                border: `2px solid ${isDone ? '#10b981' : (isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)')}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                flexShrink: 0
              }}>
                {isDone ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">    
                    <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#38bdf8' : 'rgba(255, 255, 255, 0.3)' }} />
                )}
              </div>

              {/* Action Content */}
              <div style={{ paddingBottom: '20px', flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? '#38bdf8' : '#f8fafc' }}>
                  {action.type}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {getActionSummary(action)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatAmount(amount: string | number): string {
    const val = Number(amount);
    if (isNaN(val)) return "some";
    if (val >= 1000000000) return (val / 1000000000).toFixed(4) + " SOL";
    return val.toString();
}

function getSymbol(mint?: string, preferredSymbol?: string): string {
    // 核心改进：优先使用已解析到的 Symbol
    if (preferredSymbol) return preferredSymbol;
    
    if (!mint) return "Token";
    if (mint.startsWith("So11")) return "SOL";
    if (mint.startsWith("DezX")) return "BONK";
    if (mint.startsWith("EPjF")) return "USDC";
    return mint.slice(0, 4);
}

function getActionSummary(action: SIPAction): string {
  const p = action.payload;
  switch (action.type) {
    case "SWAP":
      const from = getSymbol(p.inputMint, p.inputSymbol);
      const to = getSymbol(p.outputMint, p.outputSymbol);
      return `Swap ${formatAmount(p.amount)} to ${to}`;
    case "STAKE":
      return `Stake ${formatAmount(p.amount)} to JitoSOL`;
    case "LEND":
      return `Lend ${formatAmount(p.amount)} ${getSymbol(p.mint, p.symbol)} on Kamino`;     
    case "TRANSFER":
      return `Transfer ${formatAmount(p.amount)} to ${getSymbol(p.recipient)}...`;
    default:
      return "Executing operation...";
  }
}
