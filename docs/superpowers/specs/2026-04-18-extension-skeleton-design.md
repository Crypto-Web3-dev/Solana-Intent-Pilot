# SIP Extension Skeleton Design

## Goal

On top of the current documentation-only repository, produce a runnable Chrome extension minimum skeleton covering:

- `shared` runtime types
- `background` workflow orchestration skeleton
- `sidepanel` basic UI
- `content` minimal context detection entry point
- A fully mocked parse -> risk -> preview vertical closed loop

The goal of this design is not to connect to real services, but to verify whether the architecture, state machine, and runtime contracts defined in the current `docs/` are truly suitable for implementation.

## Scope

This round of implementation includes:

- Creating a new `extension/` code skeleton
- Landing core contracts from documentation into `shared` type files
- Setting up `background/workflow-engine.ts` and message routing skeleton
- Setting up `sidepanel` page, state subscription hook, and minimal display components
- Setting up `content/detect-context.ts` with minimal message sending capability
- Running through `intent.parse.requested -> workflow.state.changed -> execution.preview.ready` using local mock services
- Writing minimal tests for `workflow-engine` and key types

This round does not include:

- Real LLM integration
- Real Jupiter / RPC integration
- Real Wasm risk scanning
- Real wallet signing
- Production-grade visual polish

## Why This Slice

The current repository has no implementation code yet. Connecting to real services directly would mix "scaffolding setup" with "external integration debugging," which carries too much risk.

The value of doing a fully mocked vertical slice first is:

- Fastest validation of whether the boundaries in the documentation are reasonable
- Pin down the `shared -> background -> sidepanel` relationship first
- Make subsequent real service integration a matter of replacing mocks, rather than building and restructuring simultaneously
- Let tests prioritize covering the state machine and contracts, instead of being held back by external dependencies

## Architecture

### Runtime ownership

- `Background` is the sole orchestration layer
- `Side Panel` is only responsible for rendering state and sending user actions
- `Content Script` is only responsible for sending page context clues
- Mock services only return stable objects and do not participate in UI derivation

### Vertical flow

The minimum flow to run through in the first round:

1. `content` sends `context.detected`
2. `sidepanel` submits `intent.parse.requested`
3. `background` calls mock parse service
4. `background` advances workflow state based on the returned result
5. `background` calls mock risk service
6. `background` calls mock preview service
7. `sidepanel` subscribes to state and results and renders them

### Key invariants

- `needsClarification` returns to `idle`, does not enter `blocked`
- `unknown` is a risk label, not a workflow phase
- `blocked` and `failed` must be distinguishable
- All cross-context messages carry a `requestId`
- All UI consumption objects come first from `shared` stable types

## File structure

Recommended structure for the first round:

```text
extension/
├── package.json
├── tsconfig.json
├── src/
│   ├── shared/
│   │   ├── context.ts
│   │   ├── intent.ts
│   │   ├── risk.ts
│   │   ├── execution.ts
│   │   ├── workflow.ts
│   │   └── messages.ts
│   ├── background/
│   │   ├── workflow-engine.ts
│   │   ├── message-router.ts
│   │   └── mock-services.ts
│   ├── content/
│   │   └── detect-context.ts
│   └── sidepanel/
│       ├── pages/
│       │   └── SidePanelPage.tsx
│       ├── hooks/
│       │   └── useSidePanelState.ts
│       └── components/
│           ├── DetectionBar.tsx
│           ├── IntentSummaryCard.tsx
│           ├── RiskIndicator.tsx
│           └── ActionCard.tsx
└── tests/
    ├── shared/
    └── background/
```

## Component responsibilities

### `shared/`

Responsibilities:

- Carry the single source of truth for types and message contracts
- No dependency on React, Chrome API, or specific runtime implementations

Requirements:

- Directly align with `docs/api/runtime-contracts.md`
- Do not redefine approximate types in the UI layer

### `background/workflow-engine.ts`

Responsibilities:

- Maintain per-request workflow state
- Receive parse / risk / preview results and advance state
- Produce `workflow.state.changed`

Requirements:

- Align with `docs/architecture/workflow-state-machine.md`
- Do not mix in UI copy
- Prefer pure functions and small interfaces for testability

### `background/mock-services.ts`

Responsibilities:

- Return stable mock intent, mock risk, mock preview

Requirements:

- Return values must conform to `shared` types
- Cover at least 3 paths:
  - happy path
  - `needsClarification`
  - `blocked`

### `background/message-router.ts`

Responsibilities:

- Receive messages from content / sidepanel
- Call workflow engine and mock services
- Broadcast updated state and results

### `content/detect-context.ts`

Responsibilities:

- Send a minimal `DetectedContextSnapshot`

Requirements:

- Static or semi-static data is acceptable for the first round
- Complex DOM platform adaptation is not implemented in this round

### `sidepanel`

Responsibilities:

- Display workflow state, intent summary, risk information, and preview information
- Provide input fields and trigger actions

Requirements:

- Do not derive workflow phase on your own
- UI should aim for semantic correctness first, not final visuals

## Data flow

### Happy path

1. User enters a command
2. `sidepanel` sends `intent.parse.requested`
3. `background` enters `parsing`
4. Mock parse returns a valid `SIPIntent`
5. `background` enters `risk-checking`
6. Mock risk returns `low` or `medium`
7. `background` enters `quoting -> simulating`
8. Mock preview returns `ExecutionPreview`
9. `background` enters `awaiting-signature`
10. `sidepanel` displays the complete card

### Clarification path

1. Mock parse returns `needsClarification = true`
2. `background` returns to `idle`
3. `sidepanel` retains the summary and prompts the user for additional information

### Blocked path

1. Mock risk returns `blocking = true`
2. `background` enters `blocked`
3. `sidepanel` displays the blocking reason and disables the main CTA

## Error handling

The first round must support at least the following error branches:

- Parse returns an invalid structure -> `failed`
- Preview mock proactively throws an error -> `failed`
- User cancels or resets -> return to `idle`

Requirements:

- `failed` and `blocked` must be visually distinguishable
- Error reasons are provided by `background`, not guessed by components

## Testing strategy

This round adopts minimal TDD:

### `shared`

- Verify that key type exports exist
- Verify that message union types can cover core messages

### `workflow-engine`

- Happy path goes from `parsing` to `awaiting-signature`
- `needsClarification` goes from `parsing` back to `idle`
- `blocking = true` goes from `risk-checking` to `blocked`
- Preview failure enters `failed`

### UI

This round only does lightweight testing or minimal render assertions, focusing on ensuring:

- `unknown` is not displayed as success
- `blocked` and `failed` are distinguishable

## Success criteria

This round is considered complete when the following conditions are met:

- The `extension/` skeleton can be installed or at least built
- `shared` types are consistent with the documentation contracts
- The mock workflow can drive `sidepanel` to display 3 paths
- Key state machine tests pass
- Real services are not coupled with scaffolding setup

## Risks

### Risk 1: Engineering scaffolding details distract attention too early

Mitigation:

- Ensure directory structure, types, messages, and state machine are correct first
- Minimize additional dependencies

### Risk 2: Writing too much UI first can mess up state boundaries

Mitigation:

- Let `background` produce stable objects first
- `sidepanel` only does subscription and rendering

### Risk 3: Mock data diverges too far from real services

Mitigation:

- All mock return values strictly follow `runtime-contracts.md`
- Do not use UI-specific shapes

## Out of scope follow-ups

After this round is complete, the next phase will connect:

- Real LLM parse service
- Real risk/Wasm adapter
- Real quote/simulate adapter
- Wallet signing flow
- Stronger UI visual system
