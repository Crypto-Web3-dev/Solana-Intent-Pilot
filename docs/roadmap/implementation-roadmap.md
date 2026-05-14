# SIP Implementation Roadmap

## 1. Objective

Deliver a demonstrable MVP in the shortest possible cycle, completing the following core closed loop:

- Recognize context while browsing web pages
- Issue natural language intents in the Side Panel
- Obtain AI parsed results and risk conclusions
- Preview transactions and invoke wallet signing

Note:

- This is a historical roadmap, retained to illustrate how the product was implemented in phases
- The current implementation has already completed subsequent slices including base skeleton, real execution closed loop, execution preview realism, Wasm risk control, and demo polish
- For future work, please refer to [Next Phase Plan](./next-phase-plan.md)

## 2. Suggested Phases

### Phase 1: Project Skeleton and Infrastructure

- Initialize Plasmo extension project
- Establish basic communication between Side Panel, Background, and Content Script
- Integrate wallet connection capability
- Read current page URL, title, and selected text

Deliverables:

- Extension framework is runnable
- Basic state can be displayed in the Side Panel

### Phase 2: Intent Parsing Closed Loop

- Write system Prompt
- Integrate LLM service
- Validate JSON Intent with Schema
- Render parsed results to UI

Deliverables:

- Minimum viable closed loop from natural language to structured Intent

### Phase 3: Execution Preview

- Integrate Jupiter quotes
- Build transaction preview card
- Call `simulateTransaction`
- Display estimated slippage and asset changes

Deliverables:

- Users can preview transaction results before signing

### Phase 4: Local Wasm Risk Control

- Write Rust risk scanning logic
- Build artifacts using `wasm-pack`
- Load Wasm module in the extension
- Integrate risk report into Action Card

Deliverables:

- Form a "scan first, then confirm" trusted execution experience

### Phase 5: Demo Enhancement

- Enhance animations and loading feedback
- Add success, failure, and blocked states
- Optimize demo path and talking points

Deliverables:

- Complete demo version suitable for hackathon presentations

## 3. Risks and Dependencies

- LLM output may be unstable; Schema validation and fallbacks are required
- Wasm loading in Chrome MV3 has CSP constraints
- Public RPCs are prone to rate limiting; backup nodes are needed
- Wallet signing and simulation flow require real-environment verification

## 4. Priority Recommendations

If time is extremely tight, prioritize preserving the following capabilities:

1. Side Panel + page context detection
2. Intent parsing + JSON validation
3. Jupiter quotes + transaction preview
4. Minimal risk scanning

Visual enhancements, bridging, and multi-protocol expansion can be deferred to subsequent iterations.
