@# Repair Log - Solana Intent Pilot (SIP)

## [2026-04-27] - Initial Environment Check
- **Status**: Verified worktree structure.
- **Discovery**: Wasm risk engine located at src/background/wasm.
- **Action**: Initialized Repair Log and preparing for test verification.
@

## [2026-04-27] - Fixing Wasm Import Error in Tests
- **Problem**: Vitest fails to compile tests due to url: prefix and ESM Wasm imports not being recognized.
- **Strategy**: Use i.mock to stub out Wasm modules in the test file before they cause compilation errors.
- **Goal**: Enable isk-adapter.test.ts to pass by satisfying the static import requirements without loading real Wasm.
@

## [2026-04-27] - SUCCESS: Wasm Import Error Resolved
- **Resolution**: Successfully stubbed out wasm-risk-engine module in isk-adapter.test.ts.
- **Result**: Tests passed. The dependency on problematic Wasm imports is now isolated during testing.
- **Next Steps**: Continue with other pending tests or feature implementation in the atomic-strategies worktree.

---

### #016 - High Risk Wasm Results Directly Blocked Execution

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
High risk Wasm reports could move the workflow to `blocked` with `risk-blocked`, preventing the user from deciding whether to continue after seeing the risk details.

#### Root Cause
The Rust/Wasm policy set `blocking = true` for failed checks and low scores, and `workflow-engine.ts` treated any blocking report as an execution stop instead of a user-confirmation warning.

#### Fix
Wasm risk scoring now classifies reports as `low`, `medium`, `high`, or `unknown` without directly setting `blocking = true`. The workflow always proceeds from risk checking into quoting, and the side panel confirmation step shows distinct low/medium/high/unknown risk copy and button labels before the user continues.

#### Modified Files
- `risk-engine/src/lib.rs`
- `extension/src/background/workflow-engine.ts`
- `extension/src/sidepanel/components/ActionCard.tsx`
- `extension/src/sidepanel/pages/SidePanelPage.tsx`
- `extension/src/background/wasm/*`
- `extension/tests/background/risk-confirmation-flow.test.ts`
- `extension/tests/sidepanel/action-card.test.tsx`
- `docs/REPAIR_LOG.md`

#### Verification
- `cargo test`
- `wasm-pack build --target web --out-dir ../extension/src/background/wasm`
- `pnpm -C extension test -- --run tests/background/risk-confirmation-flow.test.ts tests/sidepanel/action-card.test.tsx`
- `pnpm -C extension build`

---

### #015 - Pump.fun Fresh Tokens Received 100/100 Wasm Baseline

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
Fresh pump.fun-style tokens could receive `100/100` with `Safe Baseline` even when they were unverified, low-liquidity, or newly created.

#### Root Cause
The Rust/Wasm risk engine only warned on active mint/freeze authorities, high slippage, or blacklist markers. It received `isJupVerified`, `liquidityUsd`, and `tokenCreatedAt`, but did not use unverified status, low liquidity, token age, or missing risk context as standalone risk signals.

#### Fix
The Wasm engine now marks missing risk context as `unknown`, warns on unverified low-liquidity tokens, warns on unverified tokens with unavailable liquidity, and warns on fresh unverified tokens under 24 hours old. The TS risk adapter now derives `tokenAgeHours` from Jupiter Tokens V2 `createdAt` and passes it into `riskContext`. The generated Wasm package was rebuilt.

#### Modified Files
- `risk-engine/src/lib.rs`
- `extension/src/background/risk-adapter.ts`
- `extension/src/shared/intent.ts`
- `extension/src/background/wasm/*`
- `extension/tests/background/risk-adapter.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `cargo test`
- `wasm-pack build --target web --out-dir ../extension/src/background/wasm`
- `pnpm -C extension test -- --run tests/background/risk-adapter.test.ts tests/shared/contracts.test.ts tests/sidepanel/risk-indicator.test.tsx`
- `pnpm -C extension build`

---

### #014 - Risk Enrichment Used Deprecated Jupiter Token URL

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
Risk enrichment requested `https://api.jup.ag/api/v1/token/<mint>` while the rest of SIP token metadata resolution used Jupiter Tokens V2 search.

#### Root Cause
`risk-adapter.ts` still had an older Jupiter token endpoint for verification metadata. That endpoint did not match the current Tokens V2 API used for mint/symbol lookup and could leave `isJupVerified` and liquidity context incomplete.

#### Fix
Risk enrichment now requests `https://api.jup.ag/tokens/v2/search?query=<mint>` and reads V2 fields such as `isVerified`, `tags`, `liquidity`, `createdAt`, and `audit` into the Wasm risk context. The adapter can also use Jupiter metadata when Helius is not configured.

#### Modified Files
- `extension/src/background/risk-adapter.ts`
- `extension/tests/background/risk-adapter.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/risk-adapter.test.ts tests/sidepanel/risk-indicator.test.tsx`
- `pnpm -C extension build`

---

### #013 - Wasm Baseline Displayed As Safe Without Live Risk Data

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
The side panel showed `Scan Completed`, `100/100`, and `Safe Baseline` even when live token authority and verification data were unavailable, making it look like the Wasm risk policy had not applied meaningful checks.

#### Root Cause
The Plasmo runner mapped Jupiter and OpenRouter keys into public extension variables, but did not map `HELIUS_API_KEY` to `PLASMO_PUBLIC_HELIUS_API_KEY`. Production risk enrichment could therefore miss Helius in the browser bundle. When enrichment returned no `riskContext`, the Wasm engine had no authority/liquidity inputs and emitted its baseline low-risk report.

#### Fix
The runner now maps `HELIUS_API_KEY` for extension runtime use. The risk adapter also guards against low-risk Wasm baseline results without minimum live risk data by converting them to `level = unknown` with a clear incomplete-data warning. The risk card now shows the risk source so users can distinguish Wasm from policy fallback.

#### Modified Files
- `extension/scripts/run-plasmo.mjs`
- `extension/src/background/risk-adapter.ts`
- `extension/src/sidepanel/components/RiskIndicator.tsx`
- `extension/tests/background/risk-adapter.test.ts`
- `docs/setup/development-setup.md`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/risk-adapter.test.ts tests/sidepanel/risk-indicator.test.tsx`
- `pnpm -C extension build`

---

### #004 - Wallet Connected UI Without Jupiter Taker Address

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
The UI showed "Wallet Connected", but Jupiter `/swap/v2/order` failed with `Jupiter order request requires a taker wallet public key`.

#### Root Cause
`detectWalletStatus` treated a detected `window.solana` provider as ready even when the provider had not exposed a `publicKey`. The sidepanel then submitted the intent with `userPublicKey: undefined`, so the background order request could not include Jupiter's required `taker` query parameter.

#### Fix
Wallet detection now attempts `solana.connect()` when `publicKey` is missing, returns `ready` only when a public key is available, and the sidepanel blocks live Jupiter order requests locally if no wallet address is resolved.

#### Modified Files
- `extension/src/sidepanel/wallet-bridge.ts`
- `extension/src/sidepanel/hooks/useSidePanelState.ts`
- `extension/src/sidepanel/pages/SidePanelPage.tsx`
- `extension/tests/sidepanel/wallet-bridge.test.ts`

#### Verification
- `pnpm -C extension test -- --run tests/sidepanel/wallet-bridge.test.ts`
- `pnpm -C extension test -- --run tests/background/quote-adapter.test.ts`
- `pnpm -C extension build`

---

### #005 - Jupiter API Key Missing From Extension Runtime

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
The UI reached the quote phase with a wallet address, but the Jupiter order adapter failed with `Jupiter order request requires PLASMO_PUBLIC_JUPITER_API_KEY or JUPITER_API_KEY`.

#### Root Cause
The local environment used `JUPITER_API_KEY`, while the Plasmo browser bundle only injects public client-side variables such as `PLASMO_PUBLIC_JUPITER_API_KEY`. As a result, the built extension runtime had no Jupiter key even though `.env` contained one.

#### Fix
Added a Plasmo runner script that loads the repo and extension `.env` files before `dev`/`build`, then maps `JUPITER_API_KEY` to `PLASMO_PUBLIC_JUPITER_API_KEY` when the public variable is not explicitly set.

#### Modified Files
- `extension/scripts/run-plasmo.mjs`
- `extension/package.json`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension build`
- Confirmed the Jupiter key is embedded in the extension bundle without printing the key value.
- `pnpm -C extension test -- --run tests/background/quote-adapter.test.ts`

---

### #006 - Pump.fun Selected Token Missing From Confirmation Candidates

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
On a pump.fun coin page, selecting the token symbol `FUCK` and submitting `buy 1 SOL of this` produced a confirmation message saying SIP could not find token candidates on the current page.

#### Root Cause
The content context detector only scanned body text for cashtags and base58 addresses. It did not treat selected plain uppercase token text as a candidate and did not extract the mint from `pump.fun/coin/<mint>` URLs. As a result, the parser's context-reference path had no candidate symbols to show.

#### Fix
The content detector now captures:
- selected plain uppercase token symbols such as `FUCK`;
- pump.fun coin mints from the current URL;
- token/coin mints from page links;
- a backward-compatible flat context object plus the `{ payload }` wrapper used by the sidepanel request.

#### Modified Files
- `extension/src/content/detect-context.ts`
- `extension/tests/content/detect-context.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/openai-intent-parser.test.ts tests/content/detect-context.test.ts`
- `pnpm -C extension build`

---

### #007 - Token Decimals Missing Before Intent Parsing

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
Content detection can find a pump.fun symbol or mint, but execution needs token decimals to convert UI amounts into atomic token units.

#### Root Cause
`token-context-enricher.ts` already knew how to verify Jupiter/Solscan token metadata and attach decimals, but `createDefaultIntentParser` did not call it before parsing. Production parsing therefore received raw page hints without decimals.

#### Fix
The default production parser now enriches detected page context before handing it to the OpenAI/parser layer. Production runtime passes the configured Jupiter API key into the parser so the enrichment request can use Jupiter token search metadata.

#### Modified Files
- `extension/src/background/intent-parser.ts`
- `extension/src/background/runtime-services.ts`
- `extension/tests/background/intent-parser.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/intent-parser.test.ts tests/background/token-context-enricher.test.ts tests/background/openai-intent-parser.test.ts`
- `pnpm -C extension build`

---

### #008 - Repeated Jupiter Token Metadata Queries During Confirmation

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
Submitting `buy 1 SOL of this` on a pump.fun page queried Jupiter token search for both the mint and selected symbol. Confirming the token repeated the same two requests.

#### Root Cause
The token context enricher did not cache verified token metadata across parsing attempts. It also did not reuse mint verification metadata for a matching symbol hint in the same detected context.

#### Fix
Added a small in-memory token metadata cache keyed by mint and symbol. Mint verification now remembers returned metadata, symbol-only hints reuse cached metadata when possible, and repeated enrichment calls reuse the same verified decimals/name/symbol without another Jupiter request.

#### Modified Files
- `extension/src/background/token-context-enricher.ts`
- `extension/tests/background/token-context-enricher.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/token-context-enricher.test.ts tests/background/intent-parser.test.ts`
- `pnpm -C extension build`

---

### #009 - Switch AI Intent Parsing To OpenRouter Responses API

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
The NVIDIA-compatible AI endpoint was too slow for the intent parsing loop.

#### Root Cause
`openai-intent-parser.ts` was coupled to an OpenAI SDK chat-completions streaming path configured for NVIDIA. The extension did not have a direct OpenRouter Responses API path or OpenRouter-specific environment variables.

#### Fix
Default AI parsing now calls OpenRouter's `/api/v1/responses` endpoint using `fetch`, with `openai/gpt-oss-120b:free` as the default model. The parser still accepts the existing injected legacy client in tests. The Plasmo runner maps `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` to public extension environment variables during `dev` and `build`.

#### Modified Files
- `extension/src/background/openai-intent-parser.ts`
- `extension/scripts/run-plasmo.mjs`
- `extension/tests/background/openai-intent-parser.test.ts`
- `docs/setup/development-setup.md`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/openai-intent-parser.test.ts tests/background/intent-parser.test.ts`
- `pnpm -C extension build`

---

### #012 - OpenRouter JSON Object Format Returned Empty Output

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
OpenRouter Responses API returned `status: "completed"` with `output: []` for `minimax/minimax-m2.5:free` when SIP requested `text.format.type: "json_object"` plus minimal reasoning. The UI then showed `AI output was not valid JSON`.

#### Root Cause
The selected OpenRouter model/provider combination did not reliably produce output with the Responses API JSON object formatting option. SIP also lacked a deterministic fallback for simple confirmed swap commands such as `buy 1 SOL of CRIS`.

#### Fix
Removed `text.format` and `reasoning` from the OpenRouter request body while keeping `temperature: 0` and a compact `max_output_tokens`. Added a deterministic fallback parser for common swap commands (`buy <amount> <input> of <token>`, `swap <amount> <input> to <token>`, `buy <amount> <token> with <input>`) so empty or malformed AI output does not block standard confirmed-token flows.

#### Modified Files
- `extension/src/background/openai-intent-parser.ts`
- `extension/tests/background/openai-intent-parser.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/openai-intent-parser.test.ts tests/background/intent-parser.test.ts`
- `pnpm -C extension build`

---

### #010 - Worker Fetch Illegal Invocation During Confirmed Intent Parsing

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: HIGH

#### Problem
After confirming a pump.fun token candidate, intent parsing failed with `Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation`.

#### Root Cause
The OpenRouter parser stored `globalThis.fetch` as an unbound function before calling it. In Chrome extension service workers, `fetch` expects the WorkerGlobalScope receiver, so calling the unbound function can throw `Illegal invocation`. Similar unbound default fetch usage existed in token enrichment, quote, and simulation adapters.

#### Fix
Default fetch usage is now bound to `globalThis` before being passed across adapter boundaries. Added regression coverage for OpenRouter and Jupiter token metadata calls that simulate WorkerGlobalScope receiver checks.

#### Modified Files
- `extension/src/background/openai-intent-parser.ts`
- `extension/src/background/token-context-enricher.ts`
- `extension/src/background/quote-adapter.ts`
- `extension/src/background/simulation-adapter.ts`
- `extension/tests/background/openai-intent-parser.test.ts`
- `extension/tests/background/token-context-enricher.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/openai-intent-parser.test.ts tests/background/token-context-enricher.test.ts tests/background/quote-adapter.test.ts`
- `pnpm -C extension build`

---

### #011 - OpenRouter Reasoning Output Polluting Intent JSON Parsing

**Date**: 2026-04-27
**Status**: FIXED
**Severity**: MEDIUM

#### Problem
OpenRouter Responses API returned a `reasoning` output item before the assistant message. SIP treated all `output.content.text` values as model text, so reasoning could be mixed with the actual JSON response and make the visible/parsed output noisy.

#### Root Cause
`extractResponsesText` did not distinguish OpenRouter `reasoning` items from assistant `message` items. It also did not request low-reasoning, compact JSON output.

#### Fix
Response extraction now reads only assistant `message` content parts with `type: "output_text"`. OpenRouter requests now use deterministic compact settings: `temperature: 0`, `max_output_tokens: 512`, `reasoning.effort: "minimal"`, and `text.format.type: "json_object"`.

#### Modified Files
- `extension/src/background/openai-intent-parser.ts`
- `extension/tests/background/openai-intent-parser.test.ts`
- `docs/REPAIR_LOG.md`

#### Verification
- `pnpm -C extension test -- --run tests/background/openai-intent-parser.test.ts tests/background/intent-parser.test.ts`
- `pnpm -C extension build`
