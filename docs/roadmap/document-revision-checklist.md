# SIP Document Revision Checklist

## 1. Objective

This checklist is used to resolve key conflicts already identified in `docs/`, ensuring that subsequent implementation phases do not encounter architecture rework, state drift, or acceptance ambiguity due to inconsistent document terminology.

Scope:

- `docs/architecture/`
- `docs/api/`
- `docs/security/`
- `docs/design/`
- `docs/testing/`

This checklist focuses on "what to fix first, how to fix it, and what counts as done," rather than redesigning the entire solution.

## 2. Revision Principles

- Unify runtime responsibilities first, then fix protocols and UI
- Fix conflicts that affect code boundaries first, then fix presentational issues
- Each revision item must specify an authoritative document
- Each revision item must provide acceptance criteria upon completion

## 3. P0 Revision Items

### 3.1 Unify Orchestration Center Definition

Problem:

- `architecture/message-flow.md` defines Background as the primary orchestration layer
- `modules/module-breakdown.md` defines Side Panel as the orchestration center

Risk:

- Directly affects where the state machine is placed
- Affects message routing, request retry, state caching, and cross-tab synchronization strategy
- During implementation, UI and backend can easily each hold half of the workflow

Suggested Decision:

- MVP uniformly adopts `Background as primary orchestrator`
- `Side Panel` is only responsible for state consumption, user input, and confirmation actions

Documents to Modify:

- `docs/modules/module-breakdown.md`
- `docs/design/component-architecture.md`
- If necessary, supplement `docs/architecture/system-architecture.md`

Completion Criteria:

- All documents explicitly state that `Background` is the workflow state machine and external request orchestration entry point
- All documents explicitly state that `Side Panel` does not directly handle LLM, RPC, or Wasm call orchestration
- The phrase "Side Panel is the orchestration center" no longer appears

### 3.2 Unify Risk State Model, Formally Define `unknown`

Problem:

- Security and testing documents require `unknown` to be displayed when data is missing
- `SecurityReport` and component props only define `low | medium | high`

Risk:

- During implementation, missing data can only be hard-mapped to `medium` or `warn`
- UI semantics, test assertions, and security expressions will be inconsistent

Suggested Decision:

- Extend `SecurityReport.level` to `low | medium | high | unknown`
- Clarify that `unknown` does not mean safe, nor does it mean high risk
- Clarify whether `unknown` allows continued preview and whether signing is restricted by default

Documents to Modify:

- `docs/security/risk-engine.md`
- `docs/design/component-architecture.md`
- `docs/api/ui-state-mapping.md`
- `docs/testing/qa-checklist.md`
- `docs/security/risk-cases.md`
- `docs/security/trust-boundaries.md`

Completion Criteria:

- `SecurityReport` type and UI props consistently support `unknown`
- All documents involving missing data use the same semantics
- QA and acceptance documents can clearly determine how `unknown` should be displayed and intercepted

### 3.3 Unify High-Risk Override MVP Strategy

Problem:

- UI design documents include "explicit high-risk override execution"
- Blocking rules document states that MVP does not enable override by default

Risk:

- Button behavior, demo paths, and security copy will conflict with each other
- During development, it is unclear whether the blocked state needs a secondary confirmation entry

Suggested Decision:

- MVP uniformly uses `high-risk override not enabled by default`
- If override needs to be demonstrated, mark it separately as `post-MVP` or `demo-only` capability

Documents to Modify:

- `docs/design/ui-ux-design.md`
- `docs/security/blocking-rules.md`
- `docs/testing/acceptance-criteria.md`
- `docs/roadmap/demo-script.md`

Completion Criteria:

- Blocked state CTA strategy is consistent across all documents
- Demo script no longer depends on unenabled override capability
- Acceptance criteria do not contain interaction expectations that conflict with security rules

### 3.4 Separate "Low Confidence" and "Structurally Invalid" Failure Types

Problem:

- Low confidence examples also have empty `outputMint`
- Schema requires `outputMint` to be valid
- Blocking rules specify that missing or invalid `outputMint` is directly blocked

Risk:

- State machine cannot distinguish between "clarifiable" and "parse failed"
- LLM output, frontend prompts, and execution thresholds become conflated

Suggested Decision:

- `Low confidence` still requires valid structural output, but can use `metadata` to indicate clarification is needed
- `Structurally invalid` is separately classified as `intent.parse.failed`
- If the target asset is unclear, express `needsClarification` through an explicit field rather than using an empty string placeholder

Documents to Modify:

- `docs/api/intent-schema.md`
- `docs/api/sample-payloads.md`
- `docs/security/blocking-rules.md`
- `docs/testing/acceptance-criteria.md`
- `docs/architecture/runtime-sequence.md`

Completion Criteria:

- All sample payloads are compatible with schema and blocking rules
- State machine can distinguish `parse failed`, `needs clarification`, `blocked`
- UI copy can separately express "I didn't understand" and "I understood but don't recommend executing"

Current Convergence Result:

- Changed to: when `confidence < 0.5` and `needsClarification = true`, enter clarification path
- Low confidence itself is no longer directly defined as `blocked`

## 4. P1 Revision Items

### 4.1 Unify Risk Blocking Criteria Priority

Current documents have the following stances simultaneously:

- Hitting `Mint Authority` causes immediate block
- `score < 50` blocks
- `Freeze Authority` warns or blocks depending on policy

Suggested Additions:

- Clarify the priority between "rule blocking" and "score blocking"
- Clarify whether `Freeze Authority` is a warning or a block in MVP
- Clarify whether multiple overlapping risks require displaying "primary blocking reason + secondary reasons"

Documents to Modify:

- `docs/security/risk-engine.md`
- `docs/security/blocking-rules.md`
- `docs/security/risk-cases.md`

Completion Criteria:

- The same risk example has consistent conclusions across all three documents

### 4.2 Unify Workflow State Names and Component State Names

Current Problem:

- Global workflow states in documents use `awaiting-signature`, `submitting`, `confirmed`
- Component props use `ready`, `signing`, `success`, `error`

Suggested Additions:

- Clarify that component states are a mapping layer of workflow states, not an independent state machine
- Provide a "workflow state -> component state" mapping table in the documentation

Documents to Modify:

- `docs/api/message-types.md`
- `docs/api/ui-state-mapping.md`
- `docs/design/component-architecture.md`

Completion Criteria:

- Clear mapping exists between component contracts and the global state machine
- Implementation does not need to guess state transition relationships

## 5. Recommended Execution Order

1. Define orchestration center first
2. Then define risk state model and blocking strategy
3. Then fix Intent protocol and examples
4. Finally synchronize UI, testing, and Demo documents

## 6. Post-Revision Acceptance Method

After revisions are complete, conduct a document consistency review, checking at least the following:

- Whether the same responsibility is still declared as "orchestration center" by two runtimes
- Whether `unknown` has been added to type, UI, testing, and security documents
- Whether any sample payloads still exist that are incompatible with the schema
- Whether the Demo script depends on capabilities not included in MVP
- Whether all blocked states can be traced back to explicit rules

## 7. Suggested Deliverables

If you want to further formalize this round of revisions, the most valuable next deliverables to add are:

- A `docs/architecture/workflow-state-machine.md`
- A `docs/api/runtime-contracts.md`
- A `docs/security/mvp-risk-policy.md`

This way, during subsequent code implementation, the team will have a more stable "single source of truth."
