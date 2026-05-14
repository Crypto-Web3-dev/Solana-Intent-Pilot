# SIP Intent Protocol

## 1. Goal

The Intent protocol is SIP's core contract, connecting:

- User natural language input
- LLM structured reasoning
- Local risk engine
- Quote, simulation, and on-chain execution modules

The key goals of the protocol are verifiable, evolvable, and actionable.

## 2. Top-level Structure

```ts
interface SIPIntent {
  intentId: string;
  mode: IntentMode;
  actions: SIPAction[];
  metadata: SIPIntentMetadata;
}
```

### 2.1 Example

```json
{
  "intentId": "intent-abc123",
  "mode": "SINGLE",
  "actions": [{
    "id": "action-1",
    "type": "SWAP",
    "status": "pending",
    "payload": {
      "inputMint": "So11111111111111111111111111111111111111112",
      "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "amount": "1000000000",
      "amountMode": "exact",
      "swapMode": "ExactIn",
      "slippageBps": 50,
      "platform": "Jupiter",
      "inputSymbol": "SOL",
      "outputSymbol": "USDC",
      "outputTokenName": "USD Coin",
      "outputTokenVerified": true,
      "outputTokenVerificationSource": "jupiter"
    }
  }],
  "metadata": {
    "strategyGoal": "Swap SOL to USDC",
    "reasoning": "Swap SOL to USDC via the best available route.",
    "jitoTipLamports": 0,
    "requiresRiskScan": true,
    "sourceContext": ["page-token", "selected-text"],
    "needsClarification": false
  }
}
```

## 3. Type Definitions

### 3.1 `IntentMode`

```ts
type IntentMode = "SINGLE" | "ATOMIC_BUNDLE" | "PARALLEL";
```

- `SINGLE`: one action per intent (MVP default)
- `ATOMIC_BUNDLE`: multiple actions, all-or-nothing
- `PARALLEL`: multiple actions, independent execution

### 3.2 `SIPAction`

```ts
interface SIPAction {
  id: string;
  type: "SWAP" | "STAKE" | "LEND" | "TRANSFER";
  status: "pending" | "ready" | "failed";
  payload: SIPActionPayload;
}
```

For MVP, only `SWAP` is actually executed. Other types are reserved as extension placeholders.

### 3.3 `SIPActionPayload`

| Field | Type | Description |
| --- | --- | --- |
| `inputMint` | `string?` | Input asset mint address |
| `outputMint` | `string?` | Output asset mint address |
| `amount` | `string?` | Amount in atomic units |
| `amountMode` | `string?` | Amount mode: `"exact"`, `"half"`, `"all"` |
| `swapMode` | `string?` | Swap mode: `"ExactIn"`, `"ExactOut"` |
| `slippageBps` | `number?` | Slippage tolerance in basis points |
| `platform` | `string?` | Execution protocol (e.g. `"Jupiter"`) |
| `userPublicKey` | `string?` | User's public key |
| `recipient` | `string?` | Transfer recipient address |
| `mint` | `string?` | Token mint for non-SWAP actions |
| `inputSymbol` | `string?` | Human-readable input token symbol |
| `outputSymbol` | `string?` | Human-readable output token symbol |
| `outputTokenName` | `string?` | Full name of output token |
| `outputTokenVerified` | `boolean?` | Whether output token is verified |
| `outputTokenVerificationSource` | `string?` | Verification source: `"jupiter"`, `"solscan"` |
| `outputTokenIcon` | `string?` | Token icon URL |
| `inputDecimals` | `number?` | Input token decimals |
| `outputDecimals` | `number?` | Output token decimals |

### 3.4 `SIPIntentMetadata`

```ts
interface SIPIntentMetadata {
  strategyGoal: string;
  reasoning: string;
  jitoTipLamports: number;
  requiresRiskScan: boolean;
  sourceContext: string[];
  needsClarification: boolean;
  clarification?: ClarificationPayload;
  riskContext?: RiskContext;
}
```

### 3.5 `ClarificationPayload`

When the LLM cannot fully resolve the intent, it returns a clarification request:

```ts
type ClarificationKind =
  | "missing-output-mint"
  | "unknown-output-mint"
  | "ambiguous-output-mint"
  | "underspecified-request";

interface ClarificationPayload {
  kind: ClarificationKind;
  message: string;
  candidateSymbols?: string[];
}
```

- `missing-output-mint`: no output mint could be identified
- `unknown-output-mint`: output mint symbol found but not resolvable to an address
- `ambiguous-output-mint`: multiple candidates matched, user must disambiguate
- `underspecified-request`: user input is too vague to form an intent

### 3.6 `RiskContext`

On-chain risk metadata attached to the intent after enrichment:

```ts
interface RiskContext {
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  isJupVerified?: boolean;
  liquidityUsd?: number;
  tokenCreatedAt?: number;
  tokenAgeHours?: number;
}
```

### 3.7 `estimatedNetChange`

**Note**: This field appears in runtime data (mock services, runtime-services) but is not formally typed in the `SIPAction` interface. It is used for UI display of expected balance changes:

```ts
// Used in practice but not in the formal interface
estimatedNetChange?: {
  spend?: string;   // e.g. "1 SOL"
  receive?: string; // e.g. "100 USDC"
}
```

This is a known schema drift — the field is used in mock data and some test fixtures but not declared in the type definition.

## 4. Validation Rules

- `intentId` must be present and unique
- `actions` must contain at least one action
- `action.type` must be a supported value
- For `SWAP` actions: `inputMint`, `outputMint`, and `amount` are required
- `outputMint` must be a valid Solana address or empty (triggers clarification)
- If `needsClarification` is `true`, `clarification` must be populated
- `slippageBps` defaults to `50` if not specified

## 5. Confidence Thresholds

The `confidence` field from the LLM parsing stage determines the flow:

- `>= 0.85`: proceed directly to risk scanning
- `0.5 - 0.85`: proceed with low-confidence warning
- `< 0.5` with `needsClarification`: enter clarification path

## 6. Schema Evolution

- Future: add multi-action support for `ATOMIC_BUNDLE` and `PARALLEL` modes
- Future: add `estimatedNetChange` as a formal typed field
- Future: add `STAKE`, `LEND`, `TRANSFER` action schema definitions
