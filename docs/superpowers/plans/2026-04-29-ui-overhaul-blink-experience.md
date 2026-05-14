# Blink-Style UI/UX Comprehensive Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Side Panel's Action Card to a visually striking, highly integrated Blink-style interface, including asset change preview, risk animations, and success feedback.

**Architecture:** Adopt a hybrid approach of React + Vanilla CSS + Framer Motion. ActionCard will be refactored into a modular stacked layout, supporting real-time risk color scheme switching.

**Tech Stack:** React, Framer Motion, canvas-confetti, lucide-react

---

### Task 1: Infrastructure and Animation Preparation

**Files:**
- Modify: `extension/package.json`
- Modify: `extension/src/sidepanel/styles.css`

- [ ] **Step 1: Install required dependencies**

```bash
pnpm add framer-motion canvas-confetti
pnpm add -D @types/canvas-confetti
```

- [ ] **Step 2: Add new animation keyframes in styles.css**

```css
/* Scan Ray animation */
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

/* High-risk pulse */
@keyframes high-risk-pulse {
  0% { border-color: rgba(255, 75, 75, 0.2); }
  50% { border-color: rgba(255, 75, 75, 0.8); box-shadow: 0 0 10px rgba(255, 75, 75, 0.3); }
  100% { border-color: rgba(255, 75, 75, 0.2); }
}

.animate-high-risk {
  animation: high-risk-pulse 1.5s infinite ease-in-out;
}
```

- [ ] **Step 3: Commit changes**

```bash
git add extension/package.json extension/src/sidepanel/styles.css
git commit -m "chore: add animation dependencies and keyframes"
```

---

### Task 2: Refactor ActionCard Base Layout and Color Scheme

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`
- Test: `extension/tests/sidepanel/action-card.test.tsx`

- [ ] **Step 1: Update test cases to match the new layout**

```typescript
// Modify tests/sidepanel/action-card.test.tsx to ensure it checks the new Header text
expect(html).toContain("SOLANA INTENT PILOT");
```

- [ ] **Step 2: Implement the new modular stacked layout**

```tsx
// Refactor the return value in ActionCard.tsx
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
    {/* Subsequent steps will fill in the specific content */}
  </motion.div>
);
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm test tests/sidepanel/action-card.test.tsx
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: refactor ActionCard base layout"
```

---

### Task 3: Implement Asset Change Preview (Balance Change)

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [ ] **Step 1: Implement the intuitive balance change area**

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

- [ ] **Step 2: Commit changes**

```bash
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: add balance change preview to ActionCard"
```

---

### Task 4: Risk Control Enhancement and Animation Details

**Files:**
- Modify: `extension/src/sidepanel/components/ActionCard.tsx`

- [ ] **Step 1: Implement the risk indicator with "blue light scan"**

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

- [ ] **Step 2: Trigger Confetti on transaction success**

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

- [ ] **Step 3: Commit changes**

```bash
git add extension/src/sidepanel/components/ActionCard.tsx
git commit -m "feat: add risk scan ray and success confetti"
```

---

### Task 5: Final Integration and Demo Path Verification

**Files:**
- Modify: `extension/src/sidepanel/pages/SidePanelPage.tsx`

- [ ] **Step 1: Ensure state flows smoothly and adapts to the new UI**
- [ ] **Step 2: Run full smoke tests**

```bash
pnpm test
```

- [ ] **Step 3: Commit and clean up the working tree**

```bash
git add .
git commit -m "feat: complete UI/UX overhaul"
```
