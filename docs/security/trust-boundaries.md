# SIP Trust Boundaries & Security Constraints

## 1. Purpose

The critical security question for SIP is not "does it use AI", but "which decisions can trust AI, and which absolutely cannot rely on AI alone". This document defines the trust boundaries and default constraints in the system.

## 2. Primary Boundaries

### 2.1 User Input Boundary

Sources:

- Natural language input
- Selected text on the current page
- Token text and addresses detected on the page

Constraints:

- All input is treated as untrusted
- An address appearing in page text must not be used directly as the final transaction target
- Page detection results are candidate leads only and must go through parsing and validation
- Page-derived free text and token extraction are subject to hard upper bounds (`detect-context.ts`):
  - body text ≤ 600 characters
  - selected text ≤ 120 characters
  - raw hints ≤ 2 entries, each ≤ 80 characters
  - body-derived addresses ≤ 2, tickers ≤ 2
  - total detected tokens ≤ 8

### 2.2 Page Allowlist Boundary

Source:

- `SUPPORTED_PAGE_MATCHES` (`shared/supported-pages.ts`)

Constraints:

- The allowlist is the sole authority for content-script injection, page-context selection, and signable-tab injection
- Pages not on the allowlist receive no content-script injection, are not selected as page context, and are not eligible as signing targets
- The allowlist must stay aligned with manifest `host_permissions` and content-script `config.matches`
- Allowlist changes must be synchronized across all three locations: `supported-pages.ts`, `package.json` manifest, and content-script matches

### 2.3 Content-Script Message Validation

Source:

- `chrome.runtime.onMessage` callback

Constraints:

- Content-script only responds to messages where `sender.id === chrome.runtime.id`
- Messages from other extensions are silently rejected and do not trigger context collection

### 2.4 LLM Output Boundary

Source:

- OpenAI / Claude / compatible models

Constraints:

- LLM output must pass schema validation before consumption
- LLM must not directly trigger transactions
- LLM `reasoning` is for explanation only, not a security proof

### 2.5 Local Wasm Boundary

Source:

- Rust-compiled Wasm module

Constraints:

- Wasm handles verifiable static or rule-based checks
- Wasm risk reports may influence blocking logic
- Wasm does not hold wallet state or UI state directly

### 2.6 External Service Boundary

Sources:

- RPC Provider
- Jupiter API
- Metadata or holder data services

Constraints:

- External responses may fail, lag, or return incomplete data
- Missing data must not be treated as safe by default
- External quotes are previews only; user confirmation is still required before final submission

### 2.7 Wallet Signing Boundary

Source:

- Phantom or compatible wallets

Constraints:

- Private keys and signing authority are fully controlled by the wallet
- SIP can only request signatures; it cannot custody keys or bypass confirmation
- UI must make it clear to the user what they are signing

## 3. Default Safety Rules

- Intents that fail schema validation must not enter the execution pipeline
- High-value transactions without a completed risk scan must not enter the signing pipeline
- Missing risk results must be displayed as `unknown`, never fabricated as `low`
- User confirmation must occur after the final transaction content is visible
- Any automatic execution capability must be explicitly declared and disabled by default
- MVP does not enable high-risk override by default

## 4. Typical Attack Surfaces

### 4.1 Page Poisoning

Attack vectors:

- Pages forge token symbols
- Inject misleading addresses or copy

Mitigations:

- Page allowlist gating: only supported pages (`SUPPORTED_PAGE_MATCHES`) receive content-script injection, are selected as page context, or are chosen as signable tabs
- Sender validation: content-script only responds to messages from its own extension, rejecting cross-extension injection
- Input bounds: body text, selected text, raw hints, address counts, and ticker counts all have hard upper limits, preventing malicious pages from overwhelming the parsing pipeline with massive content
- Addresses are candidate leads only and must be cross-referenced with registry, context, and risk checks

### 4.2 LLM Hallucination

Attack vectors:

- Model generates non-existent or incorrect mints
- Model misidentifies the asset the user intends to trade

Mitigations:

- Dual-layer validation: schema + business rule checks
- Low-confidence results enter a clarification path instead of direct execution
- UI displays parsing results explicitly

### 4.3 External Service Instability

Attack vectors:

- RPC rate limiting
- Quote failures
- Simulation failures

Mitigations:

- Retry logic and fallback nodes
- Failed stages are explicitly displayed to the user
- Failures are not wrapped as success or safety

### 4.4 Risk Misjudgment

Attack vectors:

- Incomplete data leads to underestimating risk

Mitigations:

- `unknown` status takes priority
- Blocking policy is conservative by default
- Check coverage is clearly displayed

## 5. UI Security Expression Requirements

- All high-risk conclusions must include specific reasons
- All blocks must indicate which check failed
- All pre-signing pages must display input assets, output assets, protocol, and estimated results
- AI-generated summaries must not be presented as definitive safety conclusions

## 6. Future Recommendations

- Add security event logging
- If high-risk override is opened in the future, a second confirmation must be designed
- Introduce finer-grained risk strategies per protocol
- Synchronize security constraints into implementation tests and QA checklists
