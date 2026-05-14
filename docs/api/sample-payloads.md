# SIP Intent Sample Payloads

## 1. Purpose

This file provides reference samples for the SIP Intent, helping development, integration, and testing phases to quickly verify:

- Whether LLM output conforms to the protocol
- Whether the UI can correctly consume the fields
- Whether the risk control and execution pipeline can handle different scenarios

## 2. Standard Success Sample

Scenario:

- The user sees a token on the page
- Types "buy 1 SOL of this coin"

```json
{
  "intent": "SWAP",
  "confidence": 0.96,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6CwBskjKpP1pPB263",
    "amount": "1000000000",
    "amountMode": "exact",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap 1 SOL into the detected page token through Jupiter.",
    "requiresRiskScan": true,
    "sourceContext": ["page-token", "selected-text"],
    "needsClarification": false
  }
}
```

Usage:

- Happy-path integration testing
- Basic Action Card rendering

## 3. Half-Position Sample

Scenario:

- The user types "swap half of my SOL to USDC"

```json
{
  "intent": "SWAP",
  "confidence": 0.93,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "0",
    "amountMode": "half",
    "slippageBps": 30,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap half of the user's SOL balance to USDC.",
    "requiresRiskScan": false,
    "sourceContext": ["user-input"],
    "needsClarification": false
  }
}
```

Note:

- When `amountMode` is not `exact`, `amount` can be a placeholder; the execution layer will calculate the real value using the actual balance

## 4. Low-Confidence Sample

Scenario:

- The user types "buy a little of this"
- Page context is insufficient

```json
{
  "intent": "SWAP",
  "confidence": 0.42,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6CwBskjKpP1pPB263",
    "amount": "0",
    "amountMode": "exact",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "The detected token is tentative and needs user confirmation before execution.",
    "requiresRiskScan": false,
    "sourceContext": ["user-input", "page-token"],
    "needsClarification": true
  }
}
```

Usage:

- Verify low-confidence prompting
- Verify the system does not proceed to the quote and execution pipeline
- Verify the "structurally valid but still requires clarification" path

## 5. High-Risk Candidate Sample

Scenario:

- The user wants to buy a newly detected token from the page
- The token must go through risk scanning

```json
{
  "intent": "SWAP",
  "confidence": 0.89,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    "amount": "500000000",
    "amountMode": "exact",
    "slippageBps": 100,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap 0.5 SOL into the newly detected token, but it requires a risk scan first.",
    "requiresRiskScan": true,
    "sourceContext": ["page-token"],
    "needsClarification": false
  }
}
```

Usage:

- Verify risk scanning gate
- Verify blocking-type Action Card

## 6. Invalid Sample

Scenario:

- LLM output has a broken structure

```json
{
  "intent": "BUY",
  "confidence": 1.4,
  "payload": {
    "inputMint": "SOL",
    "outputMint": "USDC",
    "amount": 1
  }
}
```

Expected:

- Zod validation fails
- Enters `intent.parse.failed`

## 7. Integration Tips

- Prepare corresponding UI screenshot expectations for each sample
- Keep at least one success, low-confidence, high-risk, and invalid-structure sample
- Before connecting to a live LLM, these payloads can be used to drive the frontend and state machine
