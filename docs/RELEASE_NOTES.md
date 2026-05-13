# SIP Release Notes (MVP)

## 🎯 Release Goal
Deliver a demonstratable Minimum Viable Product (MVP) that completes the core loop of intent-based execution on Solana.

## ✨ Key Features
- **Context-Aware Intention:** Automatically parses page tokens and selected text to infer user intent.
- **Natural Language Execution:** Transforms natural language commands (e.g., "swap 1 SOL for USDC") into precise transaction payloads.
- **Wasm Risk Engine:** Integrates a Rust-compiled WebAssembly engine to audit transactions locally, preventing malicious operations before wallet invocation.
- **Jupiter V2 Integration:** Fully supports Jupiter's latest V2 API, pulling real-time quotes and dynamically resolving the user's connected wallet address for execution.
- **Helius Preflight Simulation:** Runs `simulateTransaction` on RPC endpoints to guarantee transaction success and accurately display expected CU (Compute Units).
- **Duck-Typing Wallet Shim:** A custom bridge that seamlessly invokes wallets like Phantom on any webpage (even those without `@solana/web3.js` injected) by dynamically building compatible Versioned Transactions.

## 🛠️ Architecture Updates
- **Orchestrator Shift:** The `Background` script is now the undisputed orchestrator of the entire execution lifecycle. The `Side Panel` acts strictly as a dumb view/controller, communicating via a Chrome Runtime message router.
- **CSP Compliance:** Complete elimination of inline scripts (`eval` and `unsafe-inline`). Extracted wallet bridging into dedicated MV3-compliant Main World and Isolated World execution paths.

## 🐛 Notable Bug Fixes
- **`r.serialize is not a function`:** Resolved by injecting a Duck-Typing shim to simulate VersionedTransactions when a standard web3 library is unavailable on the host page.
- **Missing Jupiter `transaction` payload:** Added `taker` address resolution during intent building, satisfying Jupiter's V2 strict payload requirements.
- **Infinite Waiting States:** Handled execution cancellations and network timeouts robustly, ensuring the background engine correctly returns to an `idle` or `failed` state.

## 🧪 Testing Coverage
- Achieved stable test execution using `Vitest` across the `Background`, `SidePanel`, and `Shared` contexts, with Wasm-specific files securely mocked out for Node environments.

## ⏭️ What's Next (Post-MVP)
- **Action Card Stack:** Support multiple concurrent transaction cards.
- **Finality Polling:** Implement continuous polling for transaction confirmation statuses on the blockchain.
- **More Protocols:** Expand beyond Jupiter (e.g., lending, staking).
