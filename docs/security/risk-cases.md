# SIP Risk Case Library

## 1. Purpose

This document defines the risk cases that must be covered in the MVP stage, used for:

- Validating that risk control outputs are reasonable
- Validating that UI blocking and alerts are correct
- Preparing controllable risk paths for demo

## 2. Case Categories

### 2.1 Mint Authority Not Renounced

Risk description:

- Issuer can still mint additional tokens

Expected risk result:

- `level = high`
- `blocking = true`
- Explicitly flags `Mint Authority Enabled`

Expected UI:

- Action Card enters red blocking state
- Primary CTA disabled

### 2.2 Freeze Authority Present

Risk description:

- Project owner can freeze accounts

Expected risk result:

- At least `level = medium`
- MVP does not block on this alone

Expected UI:

- Yellow or red notice
- Specific reason must be displayed

### 2.3 Low Liquidity

Risk description:

- Even if contract permissions are normal, exit liquidity may be lacking

Expected risk result:

- `checks` includes a liquidity warning
- If combined with other risks, may escalate to `high`

Expected UI:

- Displays "insufficient liquidity" rather than only showing the total score

### 2.4 Excessive Holder Concentration

Risk description:

- Top holders are overly concentrated; dump risk may exist

Expected risk result:

- Typically `warn`
- MVP may not block by default

Expected UI:

- Displayed as a risk detail item
- Must not be disguised as a passed check

### 2.5 Data Missing

Risk description:

- Unable to obtain liquidity or holder data

Expected risk result:

- Must not display as `low`
- Should be marked as `unknown`

Expected UI:

- Displays "insufficient data, unable to fully assess"

### 2.6 Current Page Not in Allowlist

Risk description:

- Current browser tab does not belong to `SUPPORTED_PAGE_MATCHES`

Expected behavior:

- Risk evaluation is not entered; directly `blocked` + `unsupported-page`
- Wallet-detection stage returns `unsupported-page`; signature-submission stage throws a blocking error
- UI displays "Supported Page Required" and provides a link to a supported page

## 3. Combined Risk Cases

### 3.1 New Token + Mint Authority + Low Liquidity

Expected:

- Directly blocked
- Prioritized as a high-risk demo sample

### 3.2 Normal Permissions + Medium Liquidity + Concentrated Holdings

Expected:

- Allowed to proceed with `medium`
- Used to test the yellow warning path

## 4. Test Suggestions

### 4.1 Risk Rule Coverage

- Prepare simulated input and expected output for each case
- Frontend should verify that color, copy, and button states are all consistent
- Risk cases should correspond to real or reproducible test tokens when possible

### 4.2 Page Allowlist & Entry Gating

- Content script is not injected on unsupported pages
- Page context returns null for unsupported URLs
- Signable tab selection excludes unsupported pages
- Wallet-bridge returns `unsupported-page` status for unsupported pages
- Manifest `host_permissions` stays aligned with `SUPPORTED_PAGE_MATCHES`

### 4.3 Input Bounds

- Body text truncated to no more than `MAX_BODY_TEXT_CHARS` (600)
- Selected text truncated to no more than `MAX_SELECTED_TEXT_CHARS` (120)
- Raw hints count no more than `MAX_RAW_HINTS` (2), each no longer than `MAX_RAW_HINT_CHARS` (80)
- Addresses no more than `MAX_TEXT_ADDRESSES` (2), tickers no more than `MAX_TEXT_TICKERS` (2)

## 5. Demo Suggestions

The two most recommended paths for demo are:

- One clearly safe or low-risk success path
- One `Mint Authority` triggered blocking path

This best demonstrates SIP's "AI + local risk control" differentiation.
