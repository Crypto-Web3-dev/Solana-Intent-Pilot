# Gemini Context: Solana Intent Pilot (SIP)

Welcome to the Solana Intent Pilot (SIP) project. This document serves as the primary instructional context for Gemini CLI interactions within this repository.

## 1. Project Overview
SIP is a Chrome Extension (Manifest V3) designed for the Solana ecosystem. It bridges the gap between natural language user intents, browser context, and on-chain execution.
- **Core Value:** "Understand Market -> Assess Risk -> Confirm Transaction" within a seamless side panel experience.
- **Architecture:** A hybrid three-layer model:
    - **L1 Reasoning (Cloud):** LLM (OpenAI) parses natural language into structured JSON Intents.
    - **L2 Validation (Local):** Rust/Wasm-based engine performs risk assessment and pre-simulation checks.
    - **L3 Execution (On-chain):** Solana adapters (Jupiter, Web3.js) handle quotes, transaction building, and state sync.

## 2. Technology Stack
- **Extension Framework:** [Plasmo](https://www.plasmo.com/) (React + TypeScript)
- **Blockchain:** `@solana/web3.js`, Jupiter API, Solana Agent Kit
- **AI/LLM:** OpenAI (Intent parsing)
- **Local Logic:** Rust + `wasm-pack` (Risk engine)
- **Testing:** Vitest
- **Styling:** CSS Modules / Vanilla CSS (Prefer simplicity for MVP)

## 3. Directory Structure
- `extension/`: Main extension source code.
    - `src/background/`: Background service workers, message routing, and workflow orchestration.
    - `src/content/`: Content scripts for page context detection (tokens, addresses).
    - `src/sidepanel/`: Side panel UI components, hooks, and wallet integration.
    - `src/shared/`: Common types and contracts (Intent, Risk, Workflow).
- `docs/`: Formal project documentation (API, Architecture, Roadmap, etc.).
- `learn/`: Chinese development notes and exploratory specifications.
- `openspec/`: Specification-driven change management.

## 4. Key Commands
Run these commands from the `extension/` directory:
- `pnpm dev`: Start development mode with hot-reloading.
- `pnpm build`: Build the production-ready extension.
- `pnpm test`: Execute Vitest test suites.

## 5. Development Conventions & Mandates
- **Intent Protocol:** All interactions must follow the standardized `SIPIntent` JSON schema (see `docs/api/intent-schema.md`).
- **Security First:** Perform risk scans locally via Wasm before any transaction simulation or execution.
- **Language:** 所有回复必须使用中文。
- **Type Safety:** Prioritize shared types in `extension/src/shared/` to ensure consistency between background and UI.
- **Environment Variables:** Use `.env` for `OPENAI_API_KEY`, `HELIUS_API_KEY`, and RPC URLs. Never commit these keys.

## 6. Critical Documents (Global Context)
- **Security Audit:** `docs/SECURITY_AUDIT_REPORT` (Note: This file is currently missing; alert the user if needed).
- **Repair Log:** `docs/REPAIR_LOG` (Note: This file is currently missing; create it when performing first repair).

## 7. Context-Specific Instructions
- When modifying the **Intent Parser**, ensure parity with the OpenAI prompt templates in `docs/api/intent-schema.md`.
- When modifying **Wasm logic**, ensure compatibility with Manifest V3 Content Security Policy (CSP).
- When using **Search Tools**, use `findstr` instead of `grep` (per global context).
