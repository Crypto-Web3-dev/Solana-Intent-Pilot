# SIP 模块拆分

## 1. 模块总览

SIP 建议拆分为五个核心模块，每个模块聚焦单一职责，同时通过清晰的消息边界协同工作。

## 2. 模块清单

### 2.1 Web Context Capture

职责：

- 监听 DOM 变化与用户交互
- 识别页面中的代币符号、Mint 地址与文本线索
- 提取标题、URL、选中文本等上下文

关键实现：

- `MutationObserver`
- Base58 地址正则过滤
- 平台定制选择器（Twitter、Birdeye、Dexscreener 等）

输入输出：

- 输入：当前网页 DOM、用户选择行为
- 输出：`DetectedContext` 消息发送至 Background/Side Panel

### 2.2 Intent Intelligence

职责：

- 组织系统 Prompt 与上下文
- 调用 LLM 输出结构化 Intent
- 处理模型置信度、澄清需求与异常输出

关键实现：

- Few-shot Prompt
- JSON Schema / Zod 校验
- 流式输出与失败兜底

输入输出：

- 输入：用户命令、页面上下文、资产上下文
- 输出：标准 `Intent` 对象

### 2.3 Local Wasm Engine

职责：

- 风险扫描与链上数据解析
- Mint / Freeze 权限检查
- 为 UI 提供评分、标签和解释

关键实现：

- Rust + `wasm-bindgen`
- `solana-program` / `spl-token`
- 统一的 `SecurityReport` 返回结构

输入输出：

- 输入：账户原始数据、交易目标对象
- 输出：风险分值、风险标签、解释说明

### 2.4 On-chain Execution Adapter

职责：

- 连接 Jupiter、钱包和 Solana RPC
- 获取报价、构建交易、执行模拟
- 发送交易并回传结果

关键实现：

- Jupiter `/quote` 与 `/swap`
- `simulateTransaction`
- 钱包签名流程与优先费策略

输入输出：

- 输入：标准 Intent、风险校验结果
- 输出：交易预览、签名请求、链上执行状态

### 2.5 Side Panel Experience

职责：

- 承载对话、风险卡片与操作卡片
- 展示页面感知结果和执行反馈
- 提供最小学习成本的交互入口

关键实现：

- React 组件树
- Tailwind 主题系统
- Framer Motion 状态动画

输入输出：

- 输入：上下文检测结果、Intent、风险报告、执行状态
- 输出：用户交互事件、确认动作、可视反馈

## 3. 推荐目录结构

```text
sip-project/
├── extension/
│   ├── src/
│   │   ├── content/
│   │   │   └── detect-context.ts
│   │   ├── background/
│   │   │   └── message-router.ts
│   │   ├── sidepanel/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── hooks/
│   │   └── shared/
│   │       ├── intent.ts
│   │       ├── messages.ts
│   │       └── risk.ts
├── core-engine/
│   ├── src/
│   │   └── lib.rs
│   └── Cargo.toml
├── services/
│   ├── ai/
│   │   ├── prompt.ts
│   │   └── parse-intent.ts
│   └── execution/
│       ├── jupiter.ts
│       ├── simulate.ts
│       └── wallet.ts
└── docs/
```

## 4. 模块之间的边界约束

- Content Script 只负责感知，不做交易决策
- LLM 输出必须经过 schema 校验，不能直接驱动交易
- Wasm 风险引擎不持有 UI 状态，只返回纯数据
- 执行层必须读取风险结果与用户确认状态
- Background 是主编排层，负责工作流状态机、外部请求调度和跨上下文状态同步
- Side Panel 只负责展示状态、接收输入和发送确认动作，不直接编排 LLM、RPC 或 Wasm 调用

## 5. 优先实现顺序

1. Side Panel 基础框架与消息总线
2. 页面上下文检测
3. Intent 解析与 Schema 校验
4. Jupiter 报价与模拟链路
5. Rust/Wasm 风险扫描
6. UI 细节和演示增强
