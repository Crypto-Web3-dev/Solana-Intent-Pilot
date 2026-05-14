# SIP UI State Mapping

## 1. Purpose

This file defines the mapping between runtime states, UI components, and user-visible feedback, to avoid the following during implementation:

- The same state behaving inconsistently across different components
- Confusion between error states and blocked states
- UI copy falling out of sync with the underlying workflow

## 2. Top-Level State Machine

| Workflow State | Meaning | Primary UI Representation |
| --- | --- | --- |
| `idle` | Idle, awaiting input | Show empty state or most recent context |
| `detecting` | Sensing the page | Detection Bar highlighted or lightweight loading |
| `parsing` | Parsing natural language | ChatThread shows parsing-in-progress state |
| `risk-checking` | Running local scan | RiskIndicator skeleton / loading |
| `quoting` | Fetching quote | Action Card placeholder state |
| `simulating` | Simulating transaction | Action Card shows "Simulating" |
| `awaiting-signature` | Waiting for wallet confirmation | Main CTA enters signature-waiting state |
| `submitting` | Signed, submitting on-chain | Status bar shows "Submitting" |
| `confirmed` | On-chain confirmation received | Success card / Explorer link |
| `failed` | Failed at any stage | Error message and retry entry |
| `blocked` | Blocked by risk rule | Red blocking card with reason explanation |

Additional notes:

- The `unknown` in risk results is a risk label, not a separate workflow state
- When risk data is insufficient but the workflow can still proceed, the workflow may remain in the normal stage after `risk-checking`, but `RiskIndicator` and `ActionCard` must explicitly display `unknown`

## 3. Component-Level Mapping

### 3.1 Detection Bar

| State | UI Requirements |
| --- | --- |
| `idle` | Can be hidden or show most recent page context |
| `detecting` | Show detecting dynamic indicator |
| `confirmed` | Can revert to a normal info bar |
| `failed` | Does not bear primary error display; may remain silent |

### 3.2 ChatThread

| State | UI Requirements |
| --- | --- |
| `parsing` | Show AI is parsing |
| `failed` | Show parsing failure explanation |
| `blocked` | Show AI risk explanation summary |
| `confirmed` | Show success summary message |

### 3.3 RiskIndicator

| State | UI Requirements |
| --- | --- |
| `risk-checking` | skeleton / scanning in progress |
| `blocked` | Red highlight, show failed check items |
| `confirmed` | Retain final risk label |
| `failed` | If scan failed, display "Unable to complete risk assessment" |

Risk label supplement:

- `low`: Green pass state
- `medium`: Yellow warning state
- `high`: Red high-risk state
- `unknown`: Gray-yellow or neutral warning state, explicitly expressing "Insufficient data, unable to make a complete assessment"

### 3.4 ActionCard

| State | UI Requirements |
| --- | --- |
| `quoting` | Placeholder card |
| `simulating` | Main button disabled, secondary text shows simulating |
| `awaiting-signature` | Button shows waiting for signature |
| `submitting` | Button shows submitting |
| `confirmed` | Green success state |
| `failed` | Red error state, allow retry |
| `blocked` | Red blocked state, CTA disabled by default |

Additional rules:

- When `riskLevel = unknown`, if policy allows continuing preview, the CTA may remain usable, but must be accompanied by a prominent risk warning
- `blocked` and `failed` must be distinguished: the former is a policy-based block, the latter is a system or external call failure

## 4. Copy Suggestions

### 4.1 In Progress

- `Parsing your intent...`
- `Scanning target asset risk...`
- `Fetching the best trade route...`
- `Simulating pre-signature results...`

### 4.2 Blocked

- `High-risk signal detected; execution has been blocked`
- `This asset has Mint Authority, posing an inflation risk`
- `Risk data insufficient; proceeding is not recommended at this time`

### 4.3 Insufficient Data

- `Some risk data is temporarily unavailable; please proceed with caution`
- `Only partial checks could be completed; results do not guarantee asset safety`

### 4.4 Failed

- `Could not parse into an executable intent`
- `Quote temporarily unavailable; please try again later`
- `Simulation failed; unable to provide a reliable preview`

## 5. Color and Visual Rules

- `In progress`: Use brand primary color or neutral loading
- `Success`: Use green
- `Failed`: Use red, but distinguish from blocked
- `Blocked`: Use a more emphasized red, accompanied by a specific reason
- `Low confidence`: Use yellow as a prompt, not equivalent to an error

## 6. Implementation Suggestions

- Do not let each component infer state independently; drive everything from the workflow state
- Prefer centralized UI copy configuration to avoid inconsistent expressions across different files
- The same state may appear differently in different components, but the semantics must be consistent
