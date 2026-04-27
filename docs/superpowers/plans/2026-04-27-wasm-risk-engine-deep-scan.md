# Wasm Risk Engine Deep Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement a deep risk detection system in the Wasm engine using a rule-chain verdict model and backend data enrichment.

**Architecture:** A three-stage pipeline: 
1. **Enrichment**: Background script fetches on-chain data (Helius/Jupiter).
2. **Analysis**: Wasm engine correlates data points using a Rule-Chain.
3. **Verdict**: Aggregated security report with weighted scoring and blocking logic.

**Tech Stack:** Rust (Wasm), TypeScript, Plasmo, Vitest.

---

### Task 1: Update Shared Contracts
Extend the SIPIntent and SecurityReport types to support deep risk data.

**Files:**
- Modify: extension/src/shared/intent.ts
- Modify: extension/src/shared/risk.ts

- [ ] **Step 1: Add RiskContext to SIPIntent metadata**
- [ ] **Step 2: Verify type safety in shared modules**
- [ ] **Step 3: Commit**

### Task 2: Implement Rust Rule-Chain Core
Re-architect the Wasm engine to support a chain of rules.

**Files:**
- Modify: isk-engine/src/lib.rs
- Test: extension/tests/background/risk-adapter.test.ts

- [ ] **Step 1: Define the RiskContext struct in Rust**
- [ ] **Step 2: Implement the Rule-Chain loop in scan_risk**
- [ ] **Step 3: Add Rug Potential and Honeypot heuristic rules**
- [ ] **Step 4: Build Wasm: wasm-pack build --target web --out-dir ../extension/src/background/wasm**
- [ ] **Step 5: Commit**

### Task 3: Background Data Enrichment
Implement the logic to fetch and inject on-chain data into the intent before analysis.

**Files:**
- Modify: extension/src/background/risk-adapter.ts
- Modify: extension/src/background/wasm-risk-engine.ts

- [ ] **Step 1: Add enrichRiskContext function in isk-adapter.ts**
- [ ] **Step 2: Update wasm-risk-engine.ts to pass the enriched intent to Wasm**
- [ ] **Step 3: Mock Helius/Jupiter API responses for testing**
- [ ] **Step 4: Commit**

### Task 4: Verification & Integration Testing
Ensure the deep scan correctly identifies complex risk patterns.

**Files:**
- Modify: extension/tests/background/risk-adapter.test.ts

- [ ] **Step 1: Write a test case for "Rug Potential" (Enriched data -> Wasm -> Critical Block)**
- [ ] **Step 2: Write a test case for "Economic Warning" (High Price Impact)**
- [ ] **Step 3: Run all background tests and ensure PASS**
- [ ] **Step 4: Commit**
