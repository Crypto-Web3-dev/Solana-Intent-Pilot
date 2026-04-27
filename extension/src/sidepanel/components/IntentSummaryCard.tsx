import React from "react";
import type { SIPIntent } from "../../shared/intent";
import type { WorkflowPhase } from "../../shared/workflow";
import type { ExecutionPreview } from "../../shared/execution";

export function IntentSummaryCard({
  intent,
  phase,
  preview
}: {
  intent: SIPIntent | null;
  phase: WorkflowPhase;
  preview?: ExecutionPreview | null;
}) {
  if (phase === "parsing") {
    return (
      <div style={{ 
        display: 'flex', alignItems: 'center', gap: '16px', padding: '16px',
        background: 'rgba(56, 189, 248, 0.03)', borderRadius: 16, border: '1px solid rgba(56, 189, 248, 0.1)'
      }}>
        <div className="spin-slow" style={{ fontSize: '24px' }}>🔮</div>
        <div style={{ flex: 1 }}>
            <div style={{ height: 14, width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 8 }} className="animate-flow" />
            <div style={{ height: 10, width: '90%', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} className="animate-flow" />
        </div>
      </div>
    );
  }

  if (!intent) {
    return null;
  }

  const getDecimals = (symbol?: string, explicitDecimals?: number) => {
    if (typeof explicitDecimals === 'number') return explicitDecimals;
    const s = symbol?.toUpperCase();
    if (s === "USDC" || s === "USDT") return 6;
    if (s === "BONK" || s === "BONKRADIO") return 5;
    return 9;
  };

  const formatAmount = (amount: string, symbol?: string, explicitDecimals?: number) => {
    if (amount === "multi" || amount === "Multi") return "Varies";
    const val = Number(amount);
    if (isNaN(val)) return amount;
    const decimals = getDecimals(symbol, explicitDecimals);
    const formatted = (val / Math.pow(10, decimals)).toFixed(4);
    return parseFloat(formatted).toString();
  };

  const outputSymbol = intent.actions?.[0]?.payload?.outputSymbol || 'Tokens';
  const outputMint = intent.actions?.[0]?.payload?.outputMint;
  const outputDecimals = intent.actions?.[0]?.payload?.outputDecimals;
  const outputTokenName = intent.actions?.[0]?.payload?.outputTokenName;
  const outputTokenVerified = intent.actions?.[0]?.payload?.outputTokenVerified;
  const outputTokenVerificationSource = intent.actions?.[0]?.payload?.outputTokenVerificationSource;

  return (
    <div style={{ padding: '4px', animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ 
            marginTop: 4, width: 32, height: 32, borderRadius: 8, 
            background: 'rgba(56, 189, 248, 0.1)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', fontSize: 16
        }}>
            ✨
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
            {intent.metadata.strategyGoal || "Intent Target Identified"}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>
            {intent.metadata.reasoning}
          </div>
          {outputTokenVerified && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(16, 185, 129, 0.18)',
              background: 'rgba(16, 185, 129, 0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 12px rgba(16, 185, 129, 0.45)',
                flex: '0 0 auto'
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Context Token Verified
                </div>
                <div style={{ marginTop: 3, fontSize: 12, color: '#d1fae5', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {outputSymbol}{outputTokenName ? ` · ${outputTokenName}` : ''}
                </div>
                {outputMint && (
                  <div style={{ marginTop: 2, fontSize: 11, color: '#86efac', opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {outputTokenVerificationSource === 'jupiter' ? 'Jupiter Tokens' : 'Solscan'} · {outputMint}
                  </div>
                )}
              </div>
            </div>
          )}

          {preview && (
            <div style={{ 
              marginTop: 12, 
              padding: '12px', 
              background: 'rgba(0, 0, 0, 0.2)', 
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {/* 核心意图数据 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Expected Output:</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {formatAmount(preview.outputAmount, outputSymbol, outputDecimals)} {outputSymbol}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#94a3b8' }}>Slippage Tolerance:</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
                  {preview.slippageBps ? (preview.slippageBps / 100).toFixed(2) + '%' : 'Auto'}
                </span>
              </div>
              
              {/* 详细费用结构 (Fee Breakdown) */}
              <div style={{ 
                  marginTop: '4px', 
                  paddingTop: '10px', 
                  borderTop: '1px dashed rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>
                  Fee Breakdown
                </div>
                
                {/* 平台费/协议费 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>Platform Fee:</span>
                  <span style={{ color: '#f8fafc' }}>
                    {preview.platformFeeBps !== undefined ? `${preview.platformFeeBps} bps (${(preview.platformFeeBps / 100).toFixed(2)}%)` : '0 bps'}
                  </span>
                </div>

                {/* 优先级费用 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: '#94a3b8' }}>Prioritization Fee:</span>
                  </div>
                  <span style={{ color: '#f8fafc', textAlign: 'right' }}>
                    {preview.prioritizationFeeLamports || 0} Lamports
                  </span>
                </div>

                {/* 租金 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>Rent Fee:</span>
                  <span style={{ color: '#f8fafc' }}>
                    {preview.rentFeeLamports || 0} Lamports <span style={{ color: '#64748b' }}>({((preview.rentFeeLamports || 0) / 1e9).toFixed(3)} SOL)</span>
                  </span>
                </div>

                {/* 签名费 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: '#94a3b8' }}>Signature Fee:</span>
                  <span style={{ color: '#f8fafc' }}>
                    {preview.signatureFeeLamports || 0} Lamports
                  </span>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
