# SIP 文档修订清单

## 1. 目标

本清单用于收敛当前 `docs/` 中已经识别出的关键冲突，确保后续实现阶段不会因为文档口径不一致而出现架构返工、状态漂移或验收歧义。

适用范围：

- `docs/architecture/`
- `docs/api/`
- `docs/security/`
- `docs/design/`
- `docs/testing/`

本清单关注“先修什么、怎么修、修完算不算完成”，而不是重新设计整套方案。

## 2. 修订原则

- 先统一运行时职责，再修协议和 UI
- 先修会影响代码边界的冲突，再修表述性问题
- 每个修订项都必须指定权威文档
- 每个修订项都必须给出完成后的验收条件

## 3. P0 修订项

### 3.1 统一编排中心定义

问题：

- `architecture/message-flow.md` 将 Background 定义为主编排层
- `modules/module-breakdown.md` 将 Side Panel 定义为编排中心

风险：

- 会直接影响状态机放置位置
- 会影响消息路由、请求重试、状态缓存和跨 tab 同步策略
- 实现时容易出现 UI 和后台各自持有半套流程

建议决策：

- MVP 统一采用 `Background 负责主编排`
- `Side Panel` 仅负责状态消费、用户输入和确认动作

需要修改的文档：

- `docs/modules/module-breakdown.md`
- `docs/design/component-architecture.md`
- 如有必要，补充到 `docs/architecture/system-architecture.md`

完成标准：

- 所有文档都明确 `Background` 是工作流状态机和外部请求编排入口
- 所有文档都明确 `Side Panel` 不直接承担 LLM、RPC、Wasm 调用编排
- 不再出现“Side Panel 是编排中心”表述

### 3.2 统一风险状态模型，正式定义 `unknown`

问题：

- 安全文档和测试文档要求缺失数据时展示 `unknown`
- `SecurityReport` 和组件 props 只定义了 `low | medium | high`

风险：

- 实现时只能把缺失数据硬映射成 `medium` 或 `warn`
- UI 语义、测试断言和安全表达会不一致

建议决策：

- 将 `SecurityReport.level` 扩展为 `low | medium | high | unknown`
- 明确 `unknown` 不等于安全，也不等于高风险
- 明确 `unknown` 是否允许继续预览、是否默认限制签名

需要修改的文档：

- `docs/security/risk-engine.md`
- `docs/design/component-architecture.md`
- `docs/api/ui-state-mapping.md`
- `docs/testing/qa-checklist.md`
- `docs/security/risk-cases.md`
- `docs/security/trust-boundaries.md`

完成标准：

- `SecurityReport` 类型和 UI props 一致支持 `unknown`
- 所有涉及缺失数据的文档都使用同一语义
- QA 和验收文档能明确判断 `unknown` 应该如何展示和拦截

### 3.3 统一高风险 override 的 MVP 策略

问题：

- UI 设计文档包含“显式执行高风险 override”
- 阻断规则文档写明 MVP 默认不开放 override

风险：

- 按钮行为、演示路径和安全文案会互相打架
- 开发时无法确定阻断态是否需要二次确认入口

建议决策：

- MVP 统一为 `默认不开放 high-risk override`
- 如需演示 override，单独标记为 `post-MVP` 或 `demo-only` 能力

需要修改的文档：

- `docs/design/ui-ux-design.md`
- `docs/security/blocking-rules.md`
- `docs/testing/acceptance-criteria.md`
- `docs/roadmap/demo-script.md`

完成标准：

- 阻断态 CTA 策略在所有文档中一致
- Demo 脚本不再依赖未开放的 override 能力
- 验收标准中不会出现与安全规则相冲突的交互预期

### 3.4 拆分“低置信度”和“结构非法”两类失败

问题：

- 低置信度样例同时出现空 `outputMint`
- Schema 要求 `outputMint` 合法
- 阻断规则又规定缺失或非法 `outputMint` 直接阻断

风险：

- 状态机无法区分“可澄清”与“解析失败”
- LLM 输出、前端提示和执行门槛会混在一起

建议决策：

- `低置信度` 仍然要求输出合法结构，但可以用 `metadata` 标识需要澄清
- `结构非法` 单独归类为 `intent.parse.failed`
- 如目标资产不明确，优先通过显式字段表达 `needsClarification`，不要用空字符串占位

需要修改的文档：

- `docs/api/intent-schema.md`
- `docs/api/sample-payloads.md`
- `docs/security/blocking-rules.md`
- `docs/testing/acceptance-criteria.md`
- `docs/architecture/runtime-sequence.md`

完成标准：

- 示例载荷全部能和 schema、阻断规则共存
- 状态机能区分 `parse failed`、`needs clarification`、`blocked`
- UI 文案能分别表达“我没看懂”和“我看懂了但不建议执行”

当前收敛结果：

- 已改为：`confidence < 0.5` 且 `needsClarification = true` 时进入澄清路径
- 不再把低置信度本身直接定义为 `blocked`

## 4. P1 修订项

### 4.1 统一风险阻断依据的优先级

当前文档同时存在以下口径：

- 命中 `Mint Authority` 直接阻断
- `score < 50` 阻断
- `Freeze Authority` 视策略警告或阻断

建议补充：

- 明确“规则阻断”和“评分阻断”的优先级
- 明确 `Freeze Authority` 在 MVP 中到底是警告还是阻断
- 明确多风险叠加时是否需要展示“主阻断原因 + 次级原因”

需要修改的文档：

- `docs/security/risk-engine.md`
- `docs/security/blocking-rules.md`
- `docs/security/risk-cases.md`

完成标准：

- 同一风险样例在三份文档中的结论一致

### 4.2 统一工作流状态名称与组件状态名称

当前问题：

- 文档里的全局工作流状态使用 `awaiting-signature`、`submitting`、`confirmed`
- 组件 props 又使用 `ready`、`signing`、`success`、`error`

建议补充：

- 明确组件状态是工作流状态的映射层，不是另一套独立状态机
- 在文档中给出一份“工作流状态 -> 组件状态”映射表

需要修改的文档：

- `docs/api/message-types.md`
- `docs/api/ui-state-mapping.md`
- `docs/design/component-architecture.md`

完成标准：

- 组件契约和全局状态机之间有清晰映射
- 实现时不需要自行猜测状态转换关系

## 5. 推荐执行顺序

1. 先定编排中心
2. 再定风险状态模型和阻断策略
3. 再修 Intent 协议与样例
4. 最后同步 UI、测试和 Demo 文档

## 6. 修订后的验收方法

修订完成后，建议做一次文档一致性走查，至少检查以下问题：

- 是否还存在同一职责被两个运行时共同声明为“编排中心”
- `unknown` 是否已经进入类型、UI、测试和安全文档
- 是否还存在与 schema 不兼容的样例 payload
- Demo 脚本是否依赖未进入 MVP 的能力
- 所有阻断态是否都能回溯到明确规则

## 7. 建议产出

如果要把这轮修订进一步工程化，下一步最值得补的产出是：

- 一份 `docs/architecture/workflow-state-machine.md`
- 一份 `docs/api/runtime-contracts.md`
- 一份 `docs/security/mvp-risk-policy.md`

这样后续代码实现时，团队会有更稳定的“单一事实来源”。
