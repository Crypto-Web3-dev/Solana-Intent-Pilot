# SIP 系统架构

## 1. 总体架构

SIP 采用三层混合架构，在智能性、可解释性与执行性能之间取得平衡：

- L1 推理层：云端 LLM 负责把自然语言转成结构化 Intent
- L2 验证层：本地 Rust/Wasm 负责风控、解析与模拟前校验
- L3 执行层：Solana 协议适配器负责报价、构建交易、签名与状态同步

这套结构的目标是让“理解”和“执行”解耦，让云端模型负责语义，让本地逻辑负责可信判断。

## 2. 分层说明

### 2.1 感知层

由 Content Script 和 Side Panel UI 共同组成，负责收集和承载上下文：

- 抓取当前页面 URL、标题、选中文本、检测到的代币符号和地址
- 接收用户自然语言输入
- 将上下文展示为可交互的实时提示与分析卡片

### 2.2 推理层

由云端 LLM 驱动：

- 接收用户输入和页面上下文
- 输出标准化 JSON Intent
- 返回置信度、简要推理说明与是否需要风险校验

这一层强调结构化输出，而不是开放式对话。

### 2.3 验证层

由 Rust/Wasm 本地引擎驱动：

- 解析 SPL Token Mint 数据
- 检查 Mint Authority、Freeze Authority 等风险指标
- 执行轻量级链上数据解析与评分
- 为 UI 提供明确的风险状态和说明文案

### 2.4 执行层

负责对接 Solana 生态能力：

- 使用 Jupiter 获取报价与路由
- 使用钱包适配器或原生 provider 触发签名
- 调用 RPC 进行 `simulateTransaction`
- 监听执行结果并同步 UI 状态

## 3. 关键运行时链路

### 3.1 页面感知链路

1. Content Script 监听 DOM 更新或用户选择行为
2. 检测页面内的代币符号、Base58 地址和上下文文本
3. 将上下文消息发送给 Background/Side Panel
4. Side Panel 更新当前关注对象与建议动作

### 3.2 意图执行链路

1. 用户在 Side Panel 输入自然语言
2. LLM 根据页面上下文返回 JSON Intent
3. 本地 Wasm 对目标 token 或交易对象进行风险校验
4. 执行层请求报价、生成预览、模拟交易
5. 用户确认后唤起钱包签名
6. Side Panel 展示成功、失败或阻断结果

## 4. 标准 Intent 协议

系统内部需要统一的意图数据结构，确保云端和本地执行层对齐：

```json
{
  "intent": "SWAP",
  "confidence": 0.98,
  "payload": {
    "inputToken": "So11111111111111111111111111111111111111112",
    "outputToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000000",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "requiresRiskScan": true
  }
}
```

建议在实现中结合 Zod 或同类方案做运行时校验，避免格式漂移伤害下游执行链。

## 5. 通信关系

- `content -> background`: 页面上下文、地址检测结果、页面事件
- `background -> sidepanel`: 状态广播、检测结果、执行进度
- `sidepanel -> llm-service`: 用户输入与结构化推理请求
- `sidepanel/background -> wasm-engine`: 风险扫描与数据解析请求
- `execution-adapter -> solana rpc/jupiter`: 报价、模拟、交易下发

## 6. 技术选型

| 领域 | 选型 | 作用 |
| --- | --- | --- |
| 扩展框架 | Plasmo + React + TypeScript | 构建 Chrome 扩展与 Side Panel UI |
| 推理模型 | OpenAI / Claude / 兼容模型 | 结构化意图解析 |
| 本地计算 | Rust + wasm-bindgen | 风险扫描与高性能数据解析 |
| 执行适配 | Solana Agent Kit + Jupiter API | 交易能力和链上动作封装 |
| 链上数据 | Helius / QuickNode / 兼容 RPC | 余额、资产、模拟与订阅 |

## 7. 架构原则

- 云端只做语义推理，不做最终安全背书
- 本地逻辑优先处理敏感、可验证与高频计算任务
- 交易执行必须经过结构化校验和用户确认
- UI 展示应始终能解释当前动作、风险和结果
- 设计上优先支持 Demo 友好和后续模块扩展
