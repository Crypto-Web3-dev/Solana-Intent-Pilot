# SIP Demo Script

## 1. Goal

This file guides the 3-minute SIP demo, keeping the presentation focused on "context awareness + AI intent parsing + local risk engine + one-click execution."

## 2. Demo Mainline

Recommended mainline:

1. Discover a token on a web page
2. SIP automatically senses and displays context
3. User expresses a trading intent in natural language
4. SIP shows risk assessment and transaction preview
5. User confirms signature and completes the transaction

## 3. Recommended Script

### 3.1 Opening

Suggested narration:

"On Solana, you typically need to switch back and forth between tweets, market pages, DEXes, and wallets. What SIP wants to do is turn the browser directly into a Solana Intent Terminal."

### 3.2 Page Awareness

Actions:

- Open a page containing token information
- Show the Detection Bar or context card

Suggested narration:

"When I see a token on a page, SIP doesn't need me to copy and paste anything. It directly senses the on-chain clues on the current page."

### 3.3 Natural Language Intent

Actions:

- Type "buy 1 SOL of this token"

Suggested narration:

"I don't need to switch to a DEX and manually fill in parameters. I just express my intent."

### 3.4 Risk Scan & Preview

Actions:

- Show the Risk Indicator
- Show the Action Card

Suggested narration:

"AI handles understanding what I mean, but whether it's safe is not decided by AI guessing. Instead, the local Wasm risk engine checks it first."

### 3.5 Confirm & Execute

Actions:

- Click confirm
- Trigger wallet signature
- Show the success result

Suggested narration:

"After confirming, SIP gives me a complete preview, then the wallet completes the final signature."

## 4. Second Demo Path: Risk Block

Recommended to prepare a second short path:

- Identify a high-risk token
- Enter a buy command
- Risk scan result directly blocks execution

Suggested narration:

"This is not just a chatbot that only places orders for you. It also stops you from proceeding when the local scan detects obvious risks."

Notes:

- Do not rely on high-risk override in the MVP demo
- The block path should show "why you can't proceed," not "how to force it"

## 5. Demo Pacing Suggestions

- First 30 seconds: explain the problem and product positioning
- Middle 90 seconds: run the success path
- Next 30-45 seconds: run the risk block path
- Final 15 seconds: summarize the differentiated value

## 6. Closing Remarks

Suggested narration:

"So SIP isn't just about putting on-chain trading into a chat interface. It's about truly connecting context understanding, intent parsing, security validation, and execution closed-loop right inside the browser."

## 7. Rehearsal Checklist

- Pre-open the target page
- Pre-load the extension and Side Panel
- Verify wallet is connected
- Verify RPC and API Key are available
- Prepare one success path and one risk block path
