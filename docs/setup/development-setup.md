# SIP Development Setup

## 1. Purpose

This document defines the minimum development environment requirements for the SIP project, helping to quickly establish a consistent local working environment for subsequent implementation.

## 2. Base Dependencies

It is recommended to install the following tools:

- Node.js 20+
- pnpm or npm
- Rust stable toolchain
- `wasm-pack`
- Chrome or Chromium
- Phantom Wallet

For more stable Solana debugging, it is recommended to additionally prepare:

- Solana CLI
- A primary RPC and a fallback RPC
- A working LLM API Key

## 3. Recommended Environment Variables

It is recommended to use a local environment file to manage sensitive configuration:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
HELIUS_API_KEY=
QUICKNODE_RPC_URL=
FALLBACK_RPC_URL=
JUPITER_API_BASE=https://quote-api.jup.ag
JUPITER_API_KEY=
```

Rules:

- Never commit real secrets to repository documentation or source code
- Distinguish between primary and fallback nodes
- Try to use the same set of providers for local and demo environments

## 4. Local Development Workflow

### 4.1 Extension Side

Recommended workflow:

1. Start extension development mode
2. Load the unpacked extension in Chrome
3. Open the Side Panel and verify the base UI
4. Check that the Content Script can capture page context

### 4.2 Wasm Side

Recommended workflow:

1. Write Rust logic in `risk-engine/`
2. Build Wasm artifacts using `wasm-pack`
3. Connect the output to the extension side loading logic
4. Verify that a minimum risk scan result can be returned

### 4.3 Service Side

Recommended workflow:

1. Integrate LLM parsing
2. Verify JSON Intent structure with static samples
3. Integrate Jupiter quoting
4. Verify that simulation results can be displayed in the UI

## 5. Minimum Integration Check

Before formal implementation, it is recommended to first run through the following minimum chain:

- Side Panel can render
- Content Script can send `context.detected`
- LLM can output a valid `SIPIntent`
- Wasm can return a `SecurityReport`
- Quote results can render as an Action Card

## 6. Development Convention Suggestions

- Prefer placing shared types in `shared/`
- Document all message types before writing code
- Any external call must have a timeout and error state
- Run the minimum end-to-end loop first, then expand to multi-protocol and animation effects

## 7. Common Setup Risks

- Wasm loading under MV3 is affected by CSP
- Public RPCs are prone to rate limiting
- Unstable LLM output can stall the entire workflow
- The wallet signing chain requires a real browser environment for verification

## 8. Definition of Done

The development environment can be considered ready when the following conditions are met:

- The local extension can run
- Environment variables are correctly read
- Wasm build and loading chain is functional
- Primary RPC and fallback RPC are accessible
- The core integration chain can at least run through the static data version
