# SIP UI Design

## 1. Design Goals

The SIP interface needs to satisfy three things simultaneously:

- Quickly establish information hierarchy within the narrow Side Panel
- Transform on-chain complexity into understandable, confirmable action cards
- Make AI, risk scanning, and execution status form a continuous storyline

## 2. Overall Design Direction

The current approach follows the Solana ecosystem's tech-forward visual language, which is suitable as a hackathon demo starting point:

- Theme: Dark mode + glassmorphism texture
- Branding: Solana Purple and Solana Green form a high-recognition contrast
- Tone: High-density information panel + clear status feedback
- Style keywords: Real-time, precise, trustworthy, transaction-oriented

## 3. Visual System

### 3.1 Colors

| Role | Color Value | Usage |
| --- | --- | --- |
| Primary Background | `#0D0D0D` | App background |
| Secondary Background | `#1A1A1A` | Cards, input boxes, message bubbles |
| Brand Primary | `#9945FF` | CTA, key states, brand elements |
| Safe/Success | `#14F195` | Risk passed, success state, yield hints |
| Danger/Warning | `#FF4B4B` | Risk blocked, errors, cancellation |

### 3.2 Fonts

- Body text: `Inter`
- Numbers and addresses: `JetBrains Mono`

### 3.3 Border Radius and Texture

- Card border radius: 12px to 16px
- Primary button: Pill shape
- Panel should use subtle borders and light frosted glass

## 4. Side Panel Layout

### 4.1 Top Status Bar

Content:

- SIP Logo and version number
- Wallet connection status
- Current node or network status

Purpose:

- Establish brand recognition
- Inform the user whether they currently have the basic capability to execute transactions

### 4.2 Real-Time Detection Area

Content:

- Tokens, addresses, or trending cues detected on the current page
- A one-sentence AI brief
- Risk score entry or risk gauge

Purpose:

- Make the user believe the system "understands the current page"
- Provide context visualization for subsequent intent parsing

### 4.3 Conversation Area

Content:

- User bubbles
- AI streaming replies
- Processing, scanning, and other status placeholders

Purpose:

- Carry intent expression and parsing feedback
- Maintain a low-barrier experience similar to chat products

### 4.4 Action Card Area

Content:

- Transaction route
- Risk conclusion
- Simulation result
- Primary CTA and state machine

Purpose:

- Transform "suggestions" into "executable actions"
- Make the signing flow explainable

## 5. Core Component Specifications

### 5.1 Risk Indicator

Display recommendations:

- Use a continuous red-to-green visual cue
- Display key signals such as `Mint Auth`, `Freeze Auth`, `Liquidity`
- Support expanding to view detailed logs or explanations

### 5.2 Action Card

Display recommendations:

- Show input asset, output asset, and estimated amount
- Annotate protocol source, e.g. `Swap via Jupiter`
- Display simulation result and slippage
- Toggle button state based on risk level

### 5.3 Detection Bar

Display recommendations:

- Act as a lightweight alert bar or marquee
- Clicking fills "Analyze this token" into the input box

### 5.4 Chat Thread

Display recommendations:

- Clear visual distinction between AI and user messages
- Handle streaming text and status messages
- Provide clear placeholder feedback while waiting for transactions or scans

## 6. Key Interaction Flows

### 6.1 Normal Transaction Flow

1. Page detects a token or address
2. User issues a natural language command
3. AI returns a structured intent and generates an explanation
4. Wasm returns a risk conclusion
5. UI displays Action Card and simulation result
6. User confirms signature
7. UI shows execution result and Explorer link

### 6.2 Risk Block Flow

1. Wasm discovers a high-risk signal
2. Action Card switches to danger state
3. AI provides a brief risk explanation
4. In the MVP, the user can only cancel or go back; high-risk override is not available

## 7. Frontend Implementation Recommendations

- Use React component-based decomposition for Header, ChatThread, ActionCard, RiskIndicator
- Use Tailwind to manage colors, spacing, and state classes
- Use Framer Motion for card push-in, message appearance, and state transitions
- Extract design tokens into a theme file to avoid colors and sizes scattered across components

## 8. Demo Priority Recommendations

If time is limited, prioritize the following visual experiences:

- Obvious detection feedback after page scanning
- Action Card with a strong central visual presence
- Risk passed and risk blocked states are clearly distinguishable
- Success state can directly display the positive feedback of "Transaction complete"
