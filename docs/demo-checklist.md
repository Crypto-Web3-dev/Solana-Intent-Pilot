# SIP MVP Demo Checklist

Date: 2026-04-24
Applies to: `atomic-strategies` worktree

## Before the Demo

- Confirm `PLASMO_PUBLIC_NVIDIA_API_KEY` is set if you want live intent parsing.
- Confirm `PLASMO_PUBLIC_JUPITER_API_KEY` is set if you want live Jupiter-backed token and quote behavior.
- Confirm `PLASMO_PUBLIC_SOLANA_RPC_URL` is set if you want live RPC simulation behavior.
- If you want demo-only UI guidance, set `PLASMO_PUBLIC_DEMO_MODE=true`.
- Open the extension on a normal web page before starting the flow.
- If you plan to demo signing, make sure a Solana wallet extension is installed and unlocked.

## Recommended Demo Path

1. Open a Solana-related page in a normal browser tab.
2. Open the SIP sidepanel.
3. Submit a simple swap request such as `buy 1 SOL of BONK`.
4. Walk through parsed intent, risk state, and execution preview.
5. If a real wallet is available, continue to signature.
6. If no real wallet is available, stop at preview and explain that signing requires a real provider.

## What Demo Mode Changes

- Demo mode improves operator-facing guidance for unsupported pages and missing wallets.
- Demo mode provides an intentional helper URL instead of placeholder behavior.
- Demo mode does not change risk policy, workflow semantics, or live parse/simulate success criteria.

## What Demo Mode Does Not Change

- Missing parser configuration still fails explicitly.
- Failed live simulation still fails or degrades explicitly.
- Missing wallet provider still does not become a fake successful signing path.
- Mock runtime services are not enabled automatically in normal mode.

## Acceptable MVP Failure Modes

- Missing LLM configuration
- Missing wallet provider
- Unsupported page context
- Quote or simulation provider failure
- Risk result `unknown` with explicit warning

These are acceptable in MVP as long as the UI makes the state honest and understandable.
