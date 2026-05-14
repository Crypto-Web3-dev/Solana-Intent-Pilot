# SIP QA Checklist

## 1. Purpose

This checklist is used for quick QA during the implementation phase and before demos, prioritizing issues that directly affect the demo and core experience.

## 2. Page Awareness Checks

- [ ] Opening a target page triggers context detection
- [ ] Old context does not persist after switching pages
- [ ] Identified tokens or addresses do not flood the display with duplicates
- [ ] When no valid clues are found, the UI shows an empty state instead of stale data

## 3. Intent Parsing Checks

- [ ] Inputting typical natural language produces a valid Intent
- [ ] Low-confidence results have clear prompts
- [ ] Parse failures do not cause the UI to freeze
- [ ] The UI does not display raw JSON directly to regular users

## 4. Risk Scanning Checks

- [ ] There is a loading state when risk scanning starts
- [ ] Risk scanning completion shows severity level and reason
- [ ] High risk blocks the primary CTA
- [ ] Missing data displays `unknown` or a clear explanation

## 5. Quote and Simulation Checks

- [ ] Action Card data is complete when quoting succeeds
- [ ] Clear error prompt when quoting fails
- [ ] Simulation failure is not mistakenly displayed as success
- [ ] Slippage, fees, and input/output assets are displayed consistently

## 6. Wallet and Execution Checks

- [ ] Clicking confirm invokes the wallet
- [ ] User cancellation of signing restores the state
- [ ] Submitting and confirmed states transition correctly
- [ ] After success, the transaction signature or Explorer link is visible

## 7. UI and Interaction Checks

- [ ] Header, Detection Bar, ChatThread, and Action Card hierarchy is clear
- [ ] Loading, failure, blocking, and success states are easily distinguishable
- [ ] Colors do not convey risk status incorrectly
- [ ] Content does not overflow in narrow sidebars

## 8. Security Expression Checks

- [ ] AI copy does not masquerade as a safety conclusion
- [ ] High-risk alerts include specific reasons
- [ ] Pre-sign page has a clear transaction summary
- [ ] Transaction sending does not proceed without user confirmation

## 9. Pre-Demo Checks

- [ ] Stable target web page is selected
- [ ] Successful transaction example is prepared
- [ ] Risk blocking example is prepared
- [ ] RPC, wallet, and API Key are all accessible
- [ ] Extension and sidebar are pre-warmed to reduce first-load jitter

## 10. Suggested Execution Order

1. Check page awareness and Intent parsing first
2. Then check risk scanning and transaction preview
3. Finally check real wallet signing and demo paths

If time is very tight, prioritize the success path, risk blocking path, and loading/failure prompts.
