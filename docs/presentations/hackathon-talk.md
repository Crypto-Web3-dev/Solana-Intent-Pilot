# SIP Hackathon Talk

Date: 2026-04-24
Audience: hackathon judges, demo audience, and technical reviewers

## 1. One-Line Version

SIP turns messy Web3 intent into a safe, explainable execution flow: it reads the page, understands what the user means, checks risk, simulates the action, and only then asks for a signature.

## 2. 3-5 Minute Version

Today we are not trying to make Web3 faster.
We are trying to make it understandable.

Right now, one of the biggest problems in crypto is that the user is asked to sign before they really know what they are signing.
That is the dangerous part.
The wallet shows a transaction, the UI shows a button, but the real meaning is still hidden.

SIP changes that.

The first thing SIP does is read the current page and the user request together.
If you are on X and everyone is suddenly talking about a token, SIP can surface those candidates in a small token radar.
If you select one and type something like `buy this`, SIP carries that selection into the parser instead of guessing from a vague pronoun.
If you type something more explicit like `buy 1 SOL of BONK`, SIP does not treat that as a raw command either.
It turns it into a structured intent.
That means the system is no longer guessing from a sentence.
It now has a real object it can inspect, validate, and explain.

Then SIP checks whether the request is complete.
If the input is ambiguous, it asks for clarification.
If the risk is too high, it blocks the action.
If the data is incomplete, it says so honestly instead of pretending everything is safe.

If the request is still valid, SIP moves into preview mode.
It fetches quote data, runs simulation, and builds an execution preview that the user can actually read.
So instead of “click here to sign”, the user sees what will happen, how it will happen, and what the tradeoff is.

Only after that does SIP ask for a signature.
That is the key idea behind this project:
we are moving the trust boundary forward.

The vision is big.
We want every Web3 action to go through an interpretation layer that is safe, explainable, and previewable.
But the product is concrete.
Today the MVP already walks through page context, intent parsing, risk checks, preview generation, wallet confirmation, and transaction submission.
The latest demo path also shows X token radar, selected-token disambiguation, exact-in versus exact-out swap intent, Jupiter-backed quote/order preparation, and local Wasm-first risk scanning with a policy fallback.

So SIP is not just another wallet.
It is a decision layer for Web3.
It helps users understand what they are about to do before they do it.

## 3. More Energetic Opening

Imagine if every Web3 action came with a plain-English explanation before the signature.

Not after.
Before.

That is what SIP is building.

We take a user’s natural language, combine it with the current page context, and turn it into a structured action that can be checked, simulated, and explained.
If the request is unclear, we do not guess.
If the risk is too high, we stop it.
If the preview is not trustworthy, we label it honestly.

The result is simple to describe but powerful in practice:
Web3 goes from “sign and hope” to “understand, verify, then sign.”

## 4. Suggested Live Demo Script

1. Open X/Twitter or another page with token mentions.
2. Open SIP side panel.
3. Show the token radar ranking visible token candidates by frequency.
4. Select a candidate token, then type `buy this` or `buy 100 of this`.
5. Show that SIP turns the radar selection and user text into a structured intent, including whether the trade is ExactIn or ExactOut.
6. Show the risk state and explain what gets blocked, warned, or marked unknown.
7. Show the execution preview and point out that quote/order preparation and simulation happen before signing.
8. Finish with the wallet confirmation step if a wallet is available, or stop at preview and explain why that is the safer default.

## 5. Short Version for a Final Slide

SIP is a pre-signing trust layer for Web3.
It reads the page, understands the request, checks the risk, simulates the outcome, and only then asks for a signature.

## 6. Spoken Version

If you want something you can read on stage, use this version:

Today we are not trying to make Web3 transactions faster.
We are trying to make them easier to understand.

Because the biggest problem right now is not execution speed.
It is that users are asked to sign before they can really see what they are signing.

That is what SIP changes.

It reads the current page and the user’s words together, then turns natural language into a structured intent.
If the request is incomplete, it asks for clarification.
If the risk is too high, it blocks it.
If the result is still not trustworthy, it says so clearly instead of pretending everything is safe.

Only after the system has finished risk checks, quote generation, and simulation does it produce a preview that a human can actually understand.
Only then does the user get to sign.

So SIP is not another wallet.
It is more like a pre-signing explanation layer for Web3.
It turns transactions from “click confirm” into “understand, inspect, preview, then decide.”

The vision is big.
We want every on-chain action to pass through a safety explanation layer by default.
But the product is also very concrete:
this MVP already connects page context, natural language, risk checks, execution preview, and wallet confirmation into one full flow.

In one sentence:
SIP moves Web3 from “sign and check later” to “understand first, then sign.”

## 6. Does Page Context Join the Flow?

Yes.

Current implementation path:

- `getCurrentPageContext()` looks for the active normal tab
- the content script answers `context.snapshot.requested`
- on X/Twitter, the content script also scans visible tweets and sends `context.tokens.updated`
- the Side Panel token radar can store a selected token as `selectedTokenMint`
- the returned `DetectedContextSnapshot` is sent into `intent.parse.requested`
- the background parser uses selected text, detected tokens, token frequency, and radar selection to improve intent resolution and clarification

Relevant code:

- [getCurrentPageContext](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/page-context.ts>)
- [detect-context.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/content/detect-context.ts>)
- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts>)

## 7. What To Say If Someone Asks

If someone asks “what is the product really doing?”, the simplest answer is:

SIP sits between the user and the chain.
It turns raw intent into a checked, simulated, and explainable action before the wallet ever sees a signature request.
