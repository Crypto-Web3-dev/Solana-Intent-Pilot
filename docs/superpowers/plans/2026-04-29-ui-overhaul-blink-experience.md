# Blink 风格 UI/UX 全面升级 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Side Panel 的 Action Card 升级为具有视觉冲击力的、高集成度的 Blink 风格界面，包含资产变化预览、风险动效和成功反馈。

**Architecture:** 采用 React + Vanilla CSS + Framer Motion 的混合方案。ActionCard 将重构为模块化堆叠布局，支持实时风险配色切换。

**Tech Stack:** React, Framer Motion, canvas-confetti, lucide-react

---

### Task 1: 基础设施与动画准备

**Files:**
- Modify: `extension/package.json`
- Modify: `extension/src/sidepanel/styles.css`

- [ ] **Step 1: 安装必要依赖**

```bash
pnpm add framer-motion canvas-confetti
pnpm add -D @types/canvas-confetti
```

- [ ] **Step 2: 在 styles.css 中添加新的动画关键帧**

```css
/* Scan Ray 动画 */
@keyframes scan-ray-move {
  0% { left: -100%; }
  100% { left: 100%; }
}

.scan-ray-container {
  position: relative;
  overflow: hidden;
}

.scan-ray {
  position: absolute;
  top: 0;
  height: 100%;
  width: 50%;
  background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.2), transparent);
  animation: scan-ray-move 2s infinite linear;
}

/* 高风险闪烁 */
@keyframes high-risk-pulse {
  0% { border-color: rgba(255, 75, 75, 0.2); }
  50% { border-color: rgba(255, 75, 75, 0.8); box-shadow: 0 0 10px rgba(255, 75, 75, 0.3); }
  100% { border-color: rgba(255, 75, 75, 0.2); }
}

.animate-high-risk {
  animation: high-risk-pulse 1.5s infinite ease-in-out;
}
```

- [ ] **Step 3: 提交更改**

```bash
git add extension/package.json extension/src/sidepanel/styles.css
git commit -m "chore: add animation dependencies and keyframes"
```

---

### Task 2: 重构 ActionCard 基础布局与配色方案

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Test: `extension/tests/sidepanel/action-card.test.tsx`

- [ ] **Step 1: 更新测试用例以匹配新布局**

```typescript
// 修改 tests/sidepanel/action-card.test.tsx 确保它检查新的 Header 文本
expect(html).toContain("SOLANA INTENT PILOT");
```

- [ ] **Step 2: 实现新的模块化堆叠布局**

```tsx
// 在 ActionCard.tsx 中重构返回值
return (
  <motion.div 
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ type: "spring", damping: 20, stiffness: 300 }}
    style={{ 
      padding: 16, 
      background: "#020617", 
      border: `1px solid ${risk?.level === "high" ? "#FF4B4B" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 16,
      className: risk?.level === "high" ? "animate-high-risk" : ""
    }}
  >
    <div className="card-header">
       <span style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>SOLANA INTENT PILOT</span>
       <div style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", fontSize: 9, padding: "2px 6px", borderRadius: 10 }}>
         {preview?.routeLabel === "Atomic Bundle" ? "STRATEGY" : "SWAP"}
       </div>
    </div>
    {/* 后续步骤填充具体内容 */}
  </motion.div>
);
```

- [ ] **Step 3: 验证并提交**

```bash
pnpm test tests/sidepanel/action-card.test.tsx
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: refactor ActionCard base layout"
```

---

### Task 3: 实现资产变化预览 (Balance Change)

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [ ] **Step 1: 实现直观的余额变化区域**

```tsx
const BalanceArea = () => (
  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 12, padding: 12, margin: "12px 0" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 24, height: 24, background: "#9945FF", borderRadius: "50%" }} />
        <span style={{ fontWeight: 700 }}>{formatAmountWithSymbol(preview.inputAmount, inputSymbol, inputDecimals)}</span>
      </div>
      <div style={{ color: "#64748b" }}>➔</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontWeight: 700, color: "#14F195" }}>{formatAmountWithSymbol(preview.outputAmount, outputSymbol, outputDecimals)}</span>
        <div style={{ width: 24, height: 24, background: "#2775CA", borderRadius: "50%" }} />
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2: 提交更改**

```bash
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: add balance change preview to ActionCard"
```

---

### Task 4: 风控增强与动画细节

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [ ] **Step 1: 实现带有“蓝光扫描”的风险指示器**

```tsx
const RiskIndicator = () => (
  <div className={`scan-ray-container`} style={{ background: risk?.level === "high" ? "rgba(255,75,75,0.05)" : "rgba(20,241,149,0.05)", padding: "10px 12px", borderRadius: 8, borderLeft: `4px solid ${risk?.level === "high" ? "#FF4B4B" : "#14F195"}` }}>
    {phase === "risk-checking" && <div className="scan-ray" />}
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: risk?.level === "high" ? "#FF4B4B" : "#14F195", fontWeight: 800 }}>{riskConfirmation.title}</span>
      <span style={{ fontSize: 10, color: "#64748b" }}>Details ▾</span>
    </div>
  </div>
);
```

- [ ] **Step 2: 交易成功后触发 Confetti**

```typescript
useEffect(() => {
  if (isSucceeded) {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#9945FF', '#14F195', '#38BDF8']
    });
  }
}, [isSucceeded]);
```

- [ ] **Step 3: 提交更改**

```bash
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: add risk scan ray and success confetti"
```

---

### Task 5: 最终集成与 Demo 路径验证

**Files:**
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`

- [ ] **Step 1: 确保状态流畅传递并适配新 UI**
- [ ] **Step 2: 运行完整冒烟测试**

```bash
pnpm test
```

- [ ] **Step 3: 提交并清理工作树**

```bash
git add .
git commit -m "feat: complete UI/UX overhaul"
```
