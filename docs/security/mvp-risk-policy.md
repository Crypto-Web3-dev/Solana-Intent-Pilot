# SIP MVP 风险策略

## 1. 目标

本文件定义 SIP 在 MVP 阶段的统一风险策略，用来回答以下问题：

- 哪些情况必须阻断
- 哪些情况只警告，不阻断
- `unknown` 风险结果如何处理
- 是否允许继续预览、继续签名或绕过风险建议

本文件是 MVP 风险决策的单页口径，优先级高于散落在其它文档中的描述性表述。

## 2. 策略范围

本策略适用于：

- `SWAP` 意图的风险扫描结果
- 页面发现 token 后的本地风险判断
- Action Card 的可继续、警告和阻断决策
- Demo 与测试中的风险预期

本策略不覆盖：

- 生产级全协议风控
- 黑名单治理与信誉系统
- 多步复合交易的跨步骤风险评估

## 3. 决策原则

- 明确高风险优先阻断，不做“发现风险但继续默认放行”
- 数据不足时优先诚实表达，不伪装成安全
- 策略阻断和系统失败必须区分
- LLM 只能提供解释，不能提供安全背书
- MVP 默认不开放 high-risk override

## 4. 风险决策输出

风险引擎最终必须输出这三个面向策略的结论：

- `level`
- `blocking`
- `checks`

推荐理解方式：

- `level`: 给用户看的风险等级
- `source`: 给用户看的风险引擎来源，区分 `wasm` 与 `policy-fallback`
- `blocking`: 给工作流看的是否阻断
- `checks`: 给 UI 和调试看的具体原因

## 5. 风险等级定义

### 5.1 `low`

含义：

- 当前已完成的检查没有发现显著风险

MVP 动作：

- 允许继续预览
- 允许进入签名链

### 5.2 `medium`

含义：

- 存在值得提示的风险，但未达到默认阻断阈值

MVP 动作：

- 允许继续预览
- 允许进入签名链
- 必须在 UI 中给出清晰警示

### 5.3 `high`

含义：

- 命中明确阻断规则，或综合风险已达到高风险阈值

MVP 动作：

- 默认阻断
- 不允许进入签名链
- 主 CTA 禁用，仅允许取消或返回

### 5.4 `unknown`

含义：

- 数据不足，无法完成最小可信判断

MVP 动作：

- 不直接等同于 `high`
- 默认允许继续预览
- 是否允许进入签名链，取决于当前是否仍满足最小检查覆盖
- 必须以显著方式提示“数据不足，不代表安全”

## 6. MVP 阻断策略

### 6.1 明确规则阻断

以下情况命中时，优先直接阻断：

- Intent 未通过 schema 校验
- `outputMint` 缺失或非法
- 检测到 `Mint Authority`
- 风险评分 `< 50`
- 报价失败且无备用路由
- 模拟失败

说明：

- 明确规则阻断优先于评分解释
- 只要命中阻断规则，即使其它信号较好，也不应放行

### 6.2 评分阻断

当没有命中更高优先级规则时：

- `score < 50` 视为 `high`
- 默认 `blocking = true`

### 6.3 非阻断警告

以下情况在 MVP 中默认只警告：

- `confidence < 0.5` 且 `needsClarification = true`
- `0.5 <= confidence < 0.85`
- 检测到 `Freeze Authority`
- 流动性数据缺失
- 持仓集中度过高
- RPC 响应异常缓慢

## 7. `unknown` 策略

### 7.1 何时标记为 `unknown`

当满足以下条件时，应优先返回 `unknown`：

- 缺失流动性或 holder 等关键辅助数据
- 无法完成最低检查覆盖
- 无法得出“安全”或“高风险”的可信结论

### 7.2 `unknown` 的默认动作

MVP 默认规则：

- `unknown` 不直接触发阻断
- `unknown` 不得映射成 `low`
- `unknown` 允许继续查看预览
- `unknown` 进入签名链前，UI 必须再次清楚表达“当前判断不完整”

### 7.3 `unknown` 的 UI 要求

UI 必须做到：

- 与 `high` 视觉区分
- 与 `failed` 视觉区分
- 明示“数据不足”而不是“轻微风险”

推荐文案：

- `部分风险数据暂不可用，请谨慎判断`
- `当前只能完成部分检查，结果不代表资产安全`

## 8. 规则优先级

MVP 中采用以下优先级：

1. 结构非法和执行前置条件失败
2. 明确阻断规则
3. 评分阈值阻断
4. `unknown` 数据不足提示
5. 普通警告

解释：

- 结构非法和执行前置条件失败属于“不能执行”
- 明确阻断规则属于“策略禁止”
- `unknown` 属于“信息不完整”
- 低置信度澄清属于“需要补充信息后再决定”
- 普通警告属于“可以继续，但需提醒”

## 9. 允许继续的边界

### 9.1 允许继续预览

以下情况允许继续进入预览：

- `level = low`
- `level = medium`
- `level = unknown` 且未命中明确阻断规则

### 9.2 允许继续签名

以下情况允许进入签名链：

- `level = low`
- `level = medium`
- `level = unknown` 且：
  - Intent 合法
  - 风险检查已完成
  - 未命中明确阻断规则
  - UI 已显著提示风险数据不足

### 9.3 不允许继续签名

以下情况不允许进入签名链：

- `blocking = true`
- 结构非法
- `needsClarification = true`
- quote 或 simulate 失败
- 用户未确认

## 10. Override 策略

MVP 结论：

- 默认不开放 high-risk override

因此：

- `blocked` 状态下不提供“继续交易”按钮
- Demo 不依赖 override
- 测试不要求覆盖 override 交互

如后续开放 override，最低要求应包括：

- 二次确认
- 展示规则编号
- 明示这是用户主动越过安全建议

## 11. 建议实现映射

### 11.1 风险引擎到策略层

建议实现中把风险引擎输出映射为：

```ts
type RiskPolicyDecision = {
  level: "low" | "medium" | "high" | "unknown";
  blocking: boolean;
  allowPreview: boolean;
  allowSigning: boolean;
  primaryReason: string;
  triggeredRules: string[];
};
```

### 11.2 策略层到 UI 层

建议 UI 不直接根据原始检查项做主决策，而是消费策略层结论：

- `allowPreview`
- `allowSigning`
- `triggeredRules`
- `primaryReason`

这样可以避免组件各自发明一套风险逻辑。

## 12. 测试与验收要求

MVP 至少验证以下路径：

- `Mint Authority` 命中后被阻断
- `Freeze Authority` 只警告不阻断
- `confidence < 0.5` 且 `needsClarification = true` 时回到澄清路径，而不是进入 `blocked`
- 流动性数据缺失时返回 `unknown`
- `unknown` 场景不会显示为安全通过
- `high` 风险场景不会出现继续签名入口
- `failed` 和 `blocked` 在 UI 上可区分

## 13. 与其它文档的关系

- 与 [blocking-rules.md](./blocking-rules.md) 对齐规则清单
- 与 [risk-engine.md](./risk-engine.md) 对齐风险输出结构
- 与 [trust-boundaries.md](./trust-boundaries.md) 对齐默认安全原则
- 与 [risk-cases.md](./risk-cases.md) 对齐样例预期
- 与 [../api/ui-state-mapping.md](../api/ui-state-mapping.md) 对齐界面表现
