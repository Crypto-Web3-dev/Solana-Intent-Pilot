# SIP 当前运行流程说明

Date: 2026-04-24
Applies to: `atomic-strategies` worktree

## 1. 这份文档是干什么的

这是一份面向当前代码实现的运行流程说明。

它回答的是：

- 现在整个 SIP 扩展从用户输入到交易确认，实际会经过哪些步骤
- 每一步用户能做什么
- 每一步系统内部会做什么
- 每一步成功后会进入哪里
- 失败、阻断、澄清分别会怎么表现

这份文档描述的是“当前实现如何运行”，不是理想中的未来架构。

## 2. 先理解整体结构

当前运行时主要分成 3 个层次：

- `sidepanel/`
  - 接收用户输入
  - 展示阶段、风险、预览、错误
  - 发出“确认签名 / 取消 / 提交”的用户动作
- `background/`
  - 唯一工作流编排者
  - 负责解析 intent、风控、报价、模拟、预览和状态推进
- `content/`
  - 负责页面上下文提取
  - 给 sidepanel 提供当前网页的 URL、标题、选中文字、候选 token 线索

当前最核心的实现入口是：

- UI 入口：
  - [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts>)
- 编排入口：
  - [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts>)
- 状态机：
  - [workflow-engine.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/workflow-engine.ts>)

## 2.5 一张图看完整流程

```text
用户打开普通网页
  -> 打开 SIP sidepanel
  -> 输入自然语言请求
  -> sidepanel 收集页面上下文 + 钱包状态
  -> background 解析为 SIPIntent
  -> 判断是否需要 clarification / risk scan
  -> 风险检查
  -> 获取 quote / order
  -> bundle simulation
  -> 生成 ExecutionPreview
  -> 等待用户签名
  -> 提交交易
  -> confirmed / failed / blocked / 回到 idle
```

如果只想快速记主线，可以记这 4 句话：

1. `sidepanel` 负责收输入和展示结果。
2. `background` 负责决定下一步该做什么。
3. 风险、报价、模拟、预览都在 background 编排。
4. 真正签名发生在钱包侧，结果再回传给 background 更新状态。

## 3. 运行前提

在开始一轮完整流程前，当前实现默认假设下面几件事成立：

1. 扩展运行在一个普通网页环境里，而不是浏览器内部页或不支持注入的页面。
2. sidepanel 能拿到当前页面上下文。
3. background worker 已经启动并监听消息。
4. 如果要走真实解析链，`OPENROUTER_API_KEY` 已配置。
5. 如果要走真实报价/交易链，Jupiter 和 RPC 相关配置可用。
6. 如果要走真实签名链，浏览器里需要有可用的 Solana 钱包。

补充说明：

- `PLASMO_PUBLIC_DEMO_MODE=true` 只影响演示辅助提示，不改变核心执行语义。
- `NODE_ENV === "test"` 时 background 会使用 mock runtime。

## 4. 整体主链路

当前 happy path 是：

```text
打开普通网页
  -> 打开 sidepanel
  -> 输入自然语言请求
  -> 解析成 SIPIntent
  -> 风险检查
  -> 获取 quote / order
  -> bundle simulation
  -> 生成 ExecutionPreview
  -> 等待钱包签名
  -> 提交交易
  -> 交易确认
```

对应工作流状态通常是：

```text
idle
  -> parsing
  -> risk-checking
  -> quoting
  -> simulating
  -> awaiting-signature
  -> submitting
  -> confirmed
```

## 5. 按步骤说明

### 第 0 步：打开一个可用页面

你可以做什么：

- 打开一个普通网页
- 最好是和 Solana / token 相关的页面，便于页面上下文提取

系统做什么：

- `content` 侧可以读取当前页面 URL、标题、选中文本
- sidepanel 在提交前通过 `getCurrentPageContext()` 获取当前页面快照

关键代码：

- [detect-context.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/content/detect-context.ts>)
- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts:119>)

如果这一步失败：

- sidepanel 会进入 `blocked`
- `reason = "unsupported-page"`
- UI 会提示你切换到普通网页

### 第 1 步：在 Side Panel 输入请求

你可以做什么：

- 在 sidepanel 的输入框里输入自然语言命令
- 例如：
  - `buy 1 SOL of BONK`
  - `swap 10 SOL to USDC`
  - `buy this token`

系统做什么：

1. sidepanel 生成一个新的 `requestId`
2. 清空上一轮的临时状态
3. 获取当前页面上下文
4. 尝试读取当前钱包状态
5. 发送 `intent.parse.requested`

这一步发出的核心消息：

```ts
{
  type: "intent.parse.requested",
  payload: {
    requestId,
    tabId,
    userInput,
    contextSnapshot,
    userPublicKey?
  }
}
```

关键代码：

- [SidePanelPage.tsx](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/pages/SidePanelPage.tsx>)
- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts:118>)

进入下一步：

- background 收到 `intent.parse.requested`
- workflow 进入 `parsing`

### 第 2 步：解析用户意图

你可以做什么：

- 等待系统把自然语言解析成结构化 intent

系统做什么：

1. `message-router` 调用 `services.parseIntent()`
2. 当前生产 runtime 使用 `createDefaultIntentParser()`
3. 默认解析器内部会调用 `createOpenAIIntentParser()`
4. LLM 输出会被映射成当前权威结构：
   - `SIPIntent`
   - `intentId + actions[] + mode + metadata`

当前产出的核心对象：

```ts
type SIPIntent = {
  intentId: string;
  actions: SIPAction[];
  mode: "SINGLE" | "ATOMIC_BUNDLE";
  metadata: {
    requiresRiskScan: boolean;
    needsClarification: boolean;
    clarification?: ClarificationPayload;
    ...
  };
}
```

关键代码：

- [intent-parser.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/intent-parser.ts>)
- [openai-intent-parser.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/openai-intent-parser.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:49>)

可能结果有三种：

1. 解析成功
   - 发出 `intent.parse.succeeded`
   - sidepanel 展示 Intent 摘要
2. 需要澄清
   - `intent.metadata.needsClarification = true`
   - workflow 回到 `idle`
   - UI 展示 clarification 信息
3. 解析失败
   - 发出 `intent.parse.failed`
   - workflow 进入 `failed`

### 第 3 步：状态机判断是否需要澄清或风控

你可以做什么：

- 这一步基本是等待系统分流

系统做什么：

`workflow-engine` 根据 intent 决定下一状态：

1. 如果 `actions.length === 0`
   - 视为无效 intent
   - 回到 `idle`
   - reason 为 `intent-invalid`
2. 如果 `needsClarification = true`
   - 回到 `idle`
   - reason 为 `clarification-required`
3. 如果 `requiresRiskScan = true`
   - 进入 `risk-checking`
4. 否则
   - 直接进入 `quoting`

关键代码：

- [workflow-engine.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/workflow-engine.ts:42>)

### 第 4 步：风险检查

你可以做什么：

- 等待风险结果
- UI 会显示 risk 状态

系统做什么：

1. `message-router` 发出 `risk.scan.requested`
2. 当前请求按动作边界传入最小可信输入：
   - `mintAddress`
   - `sourceAction`
3. `services.scanRisk(intent)` 会调用默认风险适配器
4. 默认风险适配器优先尝试 Wasm 风控引擎
5. 如果 Wasm 不可用或异常，则回退到 policy fallback

关键代码：

- [risk-adapter.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/risk-adapter.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:88>)

可能结果：

1. 风险通过
   - workflow 进入 `quoting`
2. 风险阻断
   - workflow 进入 `blocked`
   - reason 为 `risk-blocked`
3. 风险检查失败
   - workflow 进入 `failed`
   - reason 为 `risk-check-failed`

### 第 5 步：获取报价 / 订单

你可以做什么：

- 等待系统准备交易中间产物

系统做什么：

1. router 遍历 `intent.actions`
2. 对每个 action 调用 `services.getOrder(action)`
3. 当前生产 runtime 的 quote service 来自 `createDefaultQuoteAdapter()`
4. 它内部优先走 Jupiter live quote
5. 如果 live quote 失败，当前实现仍可能回退到 mock quote adapter

这一点非常重要：

- 当前“解析失败默认不再 mock”
- 当前“签名失败默认不再 mock”
- 但是当前 quote adapter 仍保留 fallback adapter 逻辑

所以这一步是当前流程里一个仍然偏 demo/MVP 的地方。

关键代码：

- [quote-adapter.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/quote-adapter.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:122>)

状态推进方式：

- 每个 action 拿到中间产物后，`workflow-engine.handleActionReady()` 会把动作标记为 `ready`
- 当所有动作都 ready 后，工作流从 `quoting` 进入 `simulating`

### 第 6 步：Bundle 模拟

你可以做什么：

- 等待模拟结果

系统做什么：

1. router 收集所有 `swapTransaction`
2. 调用 `services.simulateBundle(transactions)`
3. 当前生产 runtime 默认用 `JitoAdapter.simulateBundle()`
4. 如果 simulation 返回 `success === false`，router 会直接抛错
5. 不会再把 live simulation 失败包装成 success-like 结果

关键代码：

- [jito-adapter.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/jito-adapter.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:141>)

结果分两类：

1. 模拟成功
   - 继续生成 preview
2. 模拟失败
   - 发出 `execution.preview.failed`
   - workflow 进入 `failed`
   - reason 为 `simulation-failed`

### 第 7 步：生成执行预览

你可以做什么：

- 查看 route、输入输出数量、fee、simulation summary

系统做什么：

1. router 调用 `services.buildPreview(requestId, intent, transactions)`
2. 当前生产 runtime 使用 `createPolicyPreviewAdapter()`
3. 如果有 bundle transactions：
   - 预览会生成 bundle 形态
   - `routeLabel = "Bundle"`
   - `bundleTransactions` 会进入 `ExecutionPreview`
4. 只有 preview 成功生成后，workflow 才进入 `awaiting-signature`

关键代码：

- [preview-adapter.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/preview-adapter.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:161>)

这一步完成后，sidepanel 会收到：

- `workflow.state.changed`
- `execution.preview.ready`

UI 中对应会更新：

- Action Card
- Wallet 状态检查
- Confirm / Cancel 按钮

### 第 8 步：等待用户签名

你可以做什么：

- 点击确认执行
- 或取消

系统做什么：

1. sidepanel 看到 `phase === "awaiting-signature"` 时，进入可签名态
2. `useEffect` 会再次检查钱包状态
3. 点击确认后，sidepanel 先发 `execution.confirmed`
4. background 状态机把状态推进到 `submitting`

关键代码：

- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts:178>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts:185>)
- [workflow-engine.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/workflow-engine.ts:103>)

如果你取消：

- sidepanel 发 `execution.cancelled`
- workflow 回到 `idle`
- reason 为 `signature-cancelled`

### 第 9 步：钱包提交和链上生命周期

你可以做什么：

- 在钱包里确认签名
- 等待提交结果

系统做什么：

1. sidepanel 调 `submitWithLifecycle()`
2. 这一步不是 background 主动签名，而是 sidepanel 通过 wallet bridge 触发网页钱包能力
3. 如果提交成功并拿到 signature：
   - sidepanel 发 `transaction.submitted`
   - 然后再发 `transaction.settled`
4. 如果失败：
   - sidepanel 发 `transaction.failed`

关键代码：

- [wallet-bridge.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/wallet-bridge.ts>)
- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts:194>)

注意：

- 当前真实签名链依赖钱包 provider
- 默认不会自动回退到 mock wallet
- demo mode 只会把提示说得更清楚，不会伪造成功签名

### 第 10 步：确认成功或失败

你可以做什么：

- 查看最终状态
- 决定是否重试

系统做什么：

如果成功：

- `workflow-engine.handleTransactionSettled()`
- 状态进入 `confirmed`
- reason 为 `confirmed`

如果失败：

- `workflow-engine.handleSubmitFailed()`
- 状态进入 `failed`
- reason 为 `submit-failed`

关键代码：

- [workflow-engine.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/workflow-engine.ts:118>)

## 6. 当前 UI 会展示哪些关键信息

当前 sidepanel 主要展示 4 块：

1. Request
   - 输入框
   - 当前阶段 Detection Bar
2. Workflow State
   - `requestId`
   - `phase`
   - `reason`
   - `walletStatus`
   - `errorMessage`
3. Intent + Risk
   - Intent Summary
   - Risk Indicator
4. Execution
   - Preview
   - Confirm / Cancel
   - Unsupported page 时的引导按钮

对应入口：

- [SidePanelPage.tsx](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/pages/SidePanelPage.tsx>)

## 7. 当前有哪些关键分支

### 7.1 澄清分支

条件：

- intent 合法
- 但 `needsClarification = true`

结果：

- 不进入 quote / simulate / sign
- workflow 回到 `idle`
- UI 保留 clarification 提示

### 7.2 风险阻断分支

条件：

- 风险报告 `blocking = true`

结果：

- workflow 进入 `blocked`
- 不允许进入签名链

### 7.3 模拟失败分支

条件：

- bundle simulation 失败
- 或 preview adapter 二次模拟失败

结果：

- workflow 进入 `failed`
- UI 显示 preview failed / simulation failed

### 7.4 钱包缺失分支

条件：

- 当前页面没有可用钱包 provider

结果：

- 解析和 preview 仍可能继续
- 但在真正签名阶段会失败
- demo mode 下会给出更明确提示：接钱包，或者演示到 preview 即止

## 8. 当前实现里的两个“现实约束”

### 8.1 已经收紧的地方

这些地方现在已经不再默认伪装成功：

- intent parse 失败不会回退到 mock intent
- Jito simulation 失败不会回退到 mock success
- wallet provider 缺失不会回退到 mock wallet

### 8.2 仍然偏 MVP / demo 的地方

这些地方仍然更像 MVP，而不是完全生产化：

1. `quote-adapter` 默认仍带 fallback adapter 逻辑
2. provider 仍然通过前端环境变量驱动
3. LLM 调用仍在扩展侧完成
4. 当前签名和提交链路有一部分逻辑仍在 sidepanel，而不是完全后移到后端

## 9. 你可以怎么用这套流程做演示

推荐演示顺序：

1. 打开一个普通网页
2. 打开 sidepanel
3. 输入一个简单 swap 请求
4. 讲解：
   - 页面上下文如何进入 request
   - 自然语言如何变成 `SIPIntent`
   - 风险检查如何阻断或放行
   - preview 如何在签名前给出解释
5. 如果钱包准备好了，再演示确认签名
6. 如果钱包没准备好，就停在 preview，并说明当前实现默认不会伪造签名成功

## 9.5 一个适合现场讲解的 3 分钟版本

如果你需要对别人快速讲清楚当前系统，可以按下面这条线说：

第一段：入口

- 用户先在普通网页里打开 SIP sidepanel
- 输入一句自然语言，比如 `buy 1 SOL of BONK`
- sidepanel 会把用户输入、当前页面上下文、钱包状态一起打包成一个请求

第二段：编排

- 这个请求会发给 background
- background 先把自然语言解析成结构化 `SIPIntent`
- 然后决定是要用户澄清、做风险检查，还是继续进入执行准备

第三段：执行前检查

- 如果风险通过，系统会去拿 quote、生成交易中间产物、做模拟
- 模拟通过后，background 才会生成一个给 UI 展示的 `ExecutionPreview`
- 只有这时流程才进入“等待签名”

第四段：提交与结果

- 用户点击确认后，sidepanel 调钱包完成签名和提交
- 提交结果再回给 background
- 最终 workflow 会进入 `confirmed`、`failed`、`blocked` 或返回 `idle`

一句话总结：

- 这套系统的核心不是“直接下单”，而是“先把自然语言变成可解释、可检查、可预览的执行请求，再决定要不要真的签名提交”。

## 10. 最值得配合阅读的文件

- 总状态机：
  - [workflow-state-machine.md](</h:/web3/SIP/.worktrees/atomic-strategies/docs/architecture/workflow-state-machine.md>)
- 消息流：
  - [message-flow.md](</h:/web3/SIP/.worktrees/atomic-strategies/docs/architecture/message-flow.md>)
- 运行时契约：
  - [runtime-contracts.md](</h:/web3/SIP/.worktrees/atomic-strategies/docs/api/runtime-contracts.md>)
- 风险策略：
  - [mvp-risk-policy.md](</h:/web3/SIP/.worktrees/atomic-strategies/docs/security/mvp-risk-policy.md>)
- demo 操作清单：
  - [demo-checklist.md](</h:/web3/SIP/.worktrees/atomic-strategies/docs/demo-checklist.md>)
