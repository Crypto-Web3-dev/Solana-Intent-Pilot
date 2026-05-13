# Jupiter Quote Preview Design

## Goal

Implement the first real provider in the execution preview path by replacing the mock quote source with a Jupiter-backed quote adapter that still falls back to mock data when the live provider is unavailable.

## Roadmap Audit

After reviewing `docs/roadmap/`, the following roadmap items are still not fully implemented in code:

- Real quote provider integration for execution preview
- Real simulation or preflight integration for execution preview
- Wasm-based local risk engine
- Stronger wallet status and connection UX for the execution path
- Demo-focused UI polish and end-to-end validation
- Engineering cleanup after mock-to-real transitions

The current codebase already has:

- Shared runtime contracts
- Background orchestration
- Side panel rendering and action flow
- OpenAI-backed intent parsing with mock fallback
- Policy-based risk adapter
- Preview adapter boundaries for `quote` and `simulate`

That makes the next highest-value slice the first half of roadmap Phase B: real quote integration.

## Scope

This design only covers real quote integration.

In scope:

- Add a Jupiter quote adapter that calls the public Jupiter quote API
- Keep the current `QuoteResult` contract stable
- Keep `PreviewAdapter` and `RuntimeServices` boundaries stable
- Fall back to the existing mock quote path when the network call fails or returns unusable data
- Add tests that prove response mapping and fallback behavior

Out of scope:

- Real transaction simulation
- RPC-backed preflight checks
- Wasm risk execution
- Wallet provider redesign
- Demo-only visual polish

## Recommended Approach

### Option 1: Replace the quote adapter with direct Jupiter fetch and no fallback

Pros:

- Simplest live integration

Cons:

- Makes local development and demos brittle
- Breaks the current mock-first safety net

### Option 2: Add a Jupiter adapter behind a default adapter that falls back to mock

Pros:

- Preserves the current architecture
- Keeps the side panel and workflow unchanged
- Safe for local development and unstable networks
- Fits the roadmap instruction to keep mock fallback during provider rollout

Cons:

- Slightly more adapter code

### Option 3: Wait and implement quote plus simulation together

Pros:

- More complete preview story

Cons:

- Larger slice
- Harder to validate quickly
- More likely to mix unrelated failures

Recommendation: Option 2.

## Design

### Quote adapter layering

Keep `QuoteAdapter` as the stable interface:

- `createMockQuoteAdapter()` remains for deterministic fallback
- `createJupiterQuoteAdapter()` performs the live fetch and maps the response
- `createDefaultQuoteAdapter()` tries Jupiter first and falls back to mock on failure

This keeps live-provider logic isolated in `background/quote-adapter.ts`.

### Provider call

Use the Jupiter public quote endpoint via `fetch`:

- base URL default: `https://lite-api.jup.ag`
- path: `/swap/v1/quote`
- query params derived from `SIPIntent.payload`

Only swap intents are supported in the current execution path, so this adapter can stay narrowly focused on the existing `SWAP` contract.

### Response mapping

Map the Jupiter response into the current `QuoteResult` shape:

- `routeLabel`: `Jupiter`
- `inputAmount`: human-readable amount derived from response `inAmount`
- `outputAmount`: human-readable amount derived from response `outAmount`
- `slippageBps`: echo the requested slippage
- `estimatedFeeLamports`: use a stable fallback string until a richer fee contract exists

This is intentionally conservative. The contract should not change in this slice.

### Failure handling

Treat these as Jupiter failures and fall back to mock:

- network errors
- non-OK HTTP responses
- malformed JSON
- missing `inAmount` or `outAmount`

The fallback should happen inside the default adapter, not in callers. `PreviewAdapter` should continue to depend on one quote interface and stay boring.

### Testing

Add quote-adapter tests for:

- successful Jupiter response mapping
- fallback to mock on network failure
- fallback to mock on malformed live response

These tests should exercise the default adapter behavior rather than only isolated helpers.

## Files

- Modify: `extension/src/background/quote-adapter.ts`
- Modify: `extension/src/background/preview-adapter.ts`
- Modify: `extension/src/background/runtime-services.ts`
- Create or expand tests: `extension/tests/background/quote-adapter.test.ts`

## Risks

- Jupiter response fields can change, so mapping should validate the minimum required shape
- Public quote endpoints can rate-limit, so fallback must stay intact
- Fee data in the current runtime contract is underspecified, so this slice should avoid widening contracts prematurely

## Success Criteria

- The default preview path uses a Jupiter-backed quote adapter first
- Preview generation still works when Jupiter is unavailable
- No runtime contract changes are required
- Tests cover both live mapping and fallback behavior
