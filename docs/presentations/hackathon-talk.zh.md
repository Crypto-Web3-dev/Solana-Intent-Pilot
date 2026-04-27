# SIP 黑客松演讲稿

日期：2026-04-24
适用对象：黑客松评委、演示观众、技术评审

## 1. 一句话版本

SIP 把混乱的 Web3 意图变成一个安全、可解释的执行流程：先读页面，理解用户想做什么，检查风险，模拟动作，最后才请求签名。

## 2. 3-5 分钟版本

今天我们不是想让 Web3 更快。
我们是想让它更容易被理解。

因为现在 Web3 最大的问题，不是执行慢，而是用户在签名之前，根本看不清自己到底在签什么。
钱包展示一个交易，界面给你一个按钮，但真正的含义还是藏在黑盒里。

SIP 改变的就是这件事。

它做的第一件事，是把当前页面和用户输入一起读进来。
如果你在 X 上看到大家突然都在讨论某个 token，SIP 会先把这些候选显示在一个小的 Token Radar 里。
如果你选中其中一个，然后输入 `buy this`，SIP 会把这个选择带进解析器，而不是凭一个模糊的“这个”去猜。
如果你输入的是更明确的 `buy 1 SOL of BONK`，SIP 也不会把它当作一条原始命令。
它会把这句话变成一个结构化意图。
这样系统就不再是猜，而是拿到了一个可以检查、可以验证、可以解释的对象。

然后 SIP 会判断这个请求是不是完整。
如果信息有歧义，它会要求澄清。
如果风险太高，它会直接阻断。
如果数据不完整，它会诚实地告诉你，而不是假装一切都安全。

如果请求仍然有效，SIP 就会进入预览阶段。
它会获取报价、运行模拟，并生成一个用户真的能读懂的执行预览。
所以用户看到的不再是“点这里签名”，而是“会发生什么、怎么发生、代价是什么”。

只有到这一步，SIP 才会请求签名。
这就是这个项目最核心的想法：
我们把信任边界往前挪了。

愿景很大。
我们希望每一次 Web3 动作，都先经过一层安全、可解释、可预览的理解层。
但产品落点也很具体。
今天这个 MVP 已经跑通了页面上下文、意图解析、风险检查、预览生成、钱包确认和交易提交这一整条链路。
最新的演示路径还包括 X Token Radar、用户选择 token 来消除歧义、ExactIn / ExactOut 交易意图区分、Jupiter quote/order 准备，以及本地 Wasm 优先的风险扫描和策略 fallback。

所以 SIP 不只是另一个钱包。
它更像是 Web3 的决策层。
它帮助用户在行动之前，先真正理解自己要做什么。

## 3. 更有冲击力的开场

想象一下，如果每一次 Web3 操作，在签名前都能先给你一段人话解释。

不是签完之后。
是签之前。

这就是 SIP 在做的事情。

我们把用户的自然语言和当前页面上下文结合起来，变成一个可以检查、可以模拟、可以解释的结构化动作。
如果请求不清楚，我们不猜。
如果风险太高，我们不放行。
如果预览不可信，我们会明确标出来。

结果很简单，但很有力量：
Web3 从“签了再说”变成“先理解，再验证，最后签”。

## 4. 现场演示步骤

1. 打开 X/Twitter，或另一个包含 token 提及的网页。
2. 打开 SIP side panel。
3. 展示 Token Radar 如何按可见内容里的出现频次排列 token 候选。
4. 选择一个候选 token，然后输入 `buy this` 或 `buy 100 of this`。
5. 展示 SIP 如何把 radar 选择和用户文本转换成结构化意图，包括这笔交易是 ExactIn 还是 ExactOut。
6. 展示风险状态，并解释哪些情况会阻断、哪些情况会警告、哪些情况会标记为 unknown。
7. 展示执行预览，说明 quote/order 准备和模拟都发生在签名前。
8. 如果有钱包，就完成签名确认；如果没有钱包，就停在预览阶段，并解释这是更安全的默认行为。

## 5. 结尾一句话版

SIP 是 Web3 的签名前信任层。
它先读页面，理解请求，检查风险，模拟结果，最后才请求签名。

## 6. 上台口语版

如果你想直接上台讲，可以用这一版：

我们今天想解决的，不是 Web3 交易怎么更快，而是怎么让它更容易被理解。

因为现在最大的问题不是执行慢，而是用户在签名之前，根本看不清自己到底在签什么。

SIP 做的事情，就是把这一步提前。

它先读当前页面，再理解用户说的话，把自然语言变成一个结构化的意图。
如果信息不够，它就先澄清。
如果风险太高，它就直接拦住。
如果结果还不够可信，它就明确告诉你：现在还不能假装安全。

只有当系统把风险、报价和模拟都跑完之后，它才会给出一个真正能读懂的预览。
然后，用户才进入签名。

所以 SIP 不是另一个钱包。
它更像是 Web3 的前置解释层。
它让交易不再只是“点确认”，而是先被理解、被检查、被预览，再决定要不要真的发生。

我们的愿景很大。
我们想让每一次链上动作，默认都先经过一层安全解释。
但落点也很具体：
今天这个 MVP 已经能把页面上下文、自然语言、风险判断、交易预览和钱包确认串成一条完整流程。

一句话说完：
SIP 让 Web3 从“签了再看”变成“看懂再签”。

## 7. 页面上下文有没有接入流程

有，而且已经接进去了。

当前实现路径是：

- `[page-context.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/page-context.ts>)` 先找当前普通网页
- `[detect-context.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/content/detect-context.ts>)` 回传 `context.snapshot.requested`
- 在 X/Twitter 上，content script 也会扫描可见推文并发送 `context.tokens.updated`
- Side Panel 的 Token Radar 可以把用户选择的 token 保存为 `selectedTokenMint`
- `[useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts>)` 把这个上下文带进 `intent.parse.requested`
- `[message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts>)` 再用选中文本、检测到的 tokens、出现频次和 radar 选择参与 intent 解析和澄清判断

相关代码：

- [getCurrentPageContext](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/page-context.ts>)
- [detect-context.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/content/detect-context.ts>)
- [useSidePanelState.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/sidepanel/hooks/useSidePanelState.ts>)
- [message-router.ts](</h:/web3/SIP/.worktrees/atomic-strategies/extension/src/background/message-router.ts>)

## 8. 如果有人问“这个产品到底在做什么”

最简单的回答是：

SIP 站在用户和链之间。
它把原始意图变成一个被检查、被模拟、可解释的动作，然后在钱包看到签名请求之前，先让用户真正理解它。
