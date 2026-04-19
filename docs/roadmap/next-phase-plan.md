# SIP 后续阶段计划

## 0. 当前状态

这份文档是当前后续工作的总入口。它基于已经完成的基础骨架、真实执行闭环、执行预览真实化、Wasm 风控和 demo polish 进行收口，并保留剩余工程整理工作的方向。

## 1. 目的

本文件用于收敛 SIP 当前已完成骨架之后的后续工作，避免每次推进都重新翻阅整套文档。

后续实现优先以本文件为入口，再按需查阅这些权威文档：

- [workflow-state-machine.md](../architecture/workflow-state-machine.md)
- [runtime-contracts.md](../api/runtime-contracts.md)
- [mvp-risk-policy.md](../security/mvp-risk-policy.md)
- [component-architecture.md](../design/component-architecture.md)
- [acceptance-criteria.md](../testing/acceptance-criteria.md)

## 2. 当前完成情况

已经完成的能力：

- `shared` 运行时契约
- `Background` 主编排层
- `Side Panel` 基础渲染和状态展示
- `content` 页面上下文采集
- `intent parse` 的 OpenAI 入口和 mock 兜底
- `risk`、`quote`、`simulate` 的独立 adapter 边界

这些工作已经足够支撑后续接入真实链路，不需要回头重做骨架。

## 3. 后续阶段总览

### 阶段 A：真实执行闭环

目标：

- 让预览之后的用户确认、钱包签名、交易提交、交易确认形成真实闭环

要做的事：

- 接入钱包状态和签名入口
- 把 `awaiting-signature -> submitting -> confirmed` 路径补成真实链路
- 明确签名取消、提交失败、确认超时的回退行为
- 保持 `workflow.state.changed` 作为 UI 唯一状态来源

阶段产出：

- 可以完成一次真实或受控环境下的签名交易演示

### 阶段 B：执行预览真实化

目标：

- 把当前 mock 的 `quote / simulate` 逐步替换为真实 provider

要做的事：

- 接入真实报价服务
- 接入真实模拟或等价预检服务
- 保留 mock fallback，确保开发环境可跑
- 对失败态、unknown 态和阻断态做稳定映射

阶段产出：

- UI 能展示真实路由、金额、滑点和模拟摘要

### 阶段 C：Wasm 风控落地

目标：

- 把策略型风险适配层升级为可运行的本地风控模块

要做的事：

- 设计 Rust 风控规则与输出结构
- 封装 Wasm 加载与初始化
- 在 MV3 约束下验证 CSP、加载路径和性能
- 保持 `SecurityReport` 和 `RiskLevel` 不变，只替换实现

阶段产出：

- 风控从策略 mock 演进为本地可执行模块

### 阶段 D：演示体验收尾

目标：

- 让 demo 更稳定、更清晰、更适合展示

要做的事：

- 强化成功态、失败态、阻断态文案
- 收紧按钮状态和 CTA 提示
- 优化加载反馈、空态和上下文提示
- 准备 3 分钟 demo 路线

阶段产出：

- 可以对外演示的稳定版本

### 阶段 E：工程收口

目标：

- 在功能稳定后做最后一轮工程整理

要做的事：

- 对齐 docs 与实现差异
- 清理废弃 mock 和过渡代码
- 补齐缺失测试
- 整理发布产物和说明文档

阶段产出：

- 一个结构清晰、可继续迭代的主分支

## 4. 建议执行顺序

推荐顺序如下：

1. 真实执行闭环
2. 执行预览真实化
3. Wasm 风控落地
4. 演示体验收尾
5. 工程收口

原因：

- 先把最接近用户价值的链路打通
- 再替换掉最明显的 mock
- 风控保持后置但不遗漏
- 最后统一整理体验和工程细节

## 5. 约定

- 后续推进默认以本文件为总入口
- 只有在修改 runtime contract、状态机或风险策略时，才回到专题文档做细化确认
- 不再要求每次都重读全部 `docs/`

## 6. 可执行任务清单

### 6.1 真实执行闭环

- 接入钱包状态查询与签名入口
- 让 `Side Panel` 能在 `awaiting-signature` 时发起确认
- 让 `Background` 正确处理 `transaction.submitted`、`transaction.settled`、`execution.cancelled`
- 补齐签名取消、提交失败、确认完成三条回退路径
- 为执行链补回归测试

### 6.2 执行预览真实化

- 将 `quote` adapter 接到真实报价提供方
- 将 `simulation` adapter 接到真实模拟或预检提供方
- 保留 mock fallback，确保本地开发可用
- 明确 quote 失败、simulate 失败和 unknown 风险的 UI 映射
- 补齐预览链测试

### 6.3 Wasm 风控落地

- 定义 Rust 风控规则的输入输出结构
- 增加 Wasm 初始化与加载层
- 验证 MV3 下的加载路径和 CSP 约束
- 保持 `SecurityReport` 不变，只替换实现
- 为高风险、unknown、缺失数据编写专门测试

### 6.4 演示体验收尾

- 收紧 Side Panel 首屏结构
- 统一 loading、blocked、failed、clarification、unknown 的文案
- 优化成功态和错误态的视觉区分
- 准备一条成功演示路径和一条阻断演示路径

### 6.5 工程收口

- 对齐 docs 与实现差异
- 清理过渡期 mock 和废弃入口
- 补齐遗漏测试
- 整理发布说明与构建产物

## 7. 建议开工顺序

1. 真实执行闭环
2. 执行预览真实化
3. Wasm 风控落地
4. 演示体验收尾
5. 工程收口

这个顺序的好处是：

- 先做最影响“能不能真正用”的部分
- 再替换掉最容易被真实服务打断的模拟层
- 风控作为独立阶段推进，风险和实现边界更清晰
- 最后再做演示和收口，不会把结构改乱
