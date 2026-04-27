# SIP Intent 样例载荷

## 1. 目标

本文件提供 SIP Intent 的参考样例，帮助开发、联调和测试阶段快速验证：

- LLM 输出是否满足协议
- UI 是否能正确消费字段
- 风控和执行链是否能接住不同情形

## 2. 标准成功样例

场景：

- 用户在页面上看到某个 token
- 输入“买 1 SOL 的这个币”

```json
{
  "intent": "SWAP",
  "confidence": 0.96,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "amount": "1000000000",
    "amountMode": "exact",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap 1 SOL into the detected page token through Jupiter.",
    "requiresRiskScan": true,
    "sourceContext": ["page-token", "selected-text"],
    "needsClarification": false
  }
}
```

用途：

- Happy path 联调
- Action Card 基础渲染

## 3. 半仓样例

场景：

- 用户输入“把一半 SOL 换成 USDC”

```json
{
  "intent": "SWAP",
  "confidence": 0.93,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "0",
    "amountMode": "half",
    "slippageBps": 30,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap half of the user's SOL balance to USDC.",
    "requiresRiskScan": false,
    "sourceContext": ["user-input"],
    "needsClarification": false
  }
}
```

说明：

- 当 `amountMode` 不是 `exact` 时，`amount` 可先占位，由执行层用真实余额换算

## 4. 低置信度样例

场景：

- 用户输入“买一点这个”
- 页面线索不充分

```json
{
  "intent": "SWAP",
  "confidence": 0.42,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    "amount": "0",
    "amountMode": "exact",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "The detected token is tentative and needs user confirmation before execution.",
    "requiresRiskScan": false,
    "sourceContext": ["user-input", "page-token"],
    "needsClarification": true
  }
}
```

用途：

- 验证低置信度提示
- 验证系统不会继续进入报价和执行链
- 验证“结构合法但仍需澄清”的路径

## 5. 高风险候选样例

场景：

- 用户想买页面上识别到的新币
- 该 token 必须进入风险扫描

```json
{
  "intent": "SWAP",
  "confidence": 0.89,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    "amount": "500000000",
    "amountMode": "exact",
    "slippageBps": 100,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap 0.5 SOL into the newly detected token, but it requires a risk scan first.",
    "requiresRiskScan": true,
    "sourceContext": ["page-token"],
    "needsClarification": false
  }
}
```

用途：

- 验证风险扫描前置
- 验证阻断型 Action Card

## 6. 非法样例

场景：

- LLM 输出结构损坏

```json
{
  "intent": "BUY",
  "confidence": 1.4,
  "payload": {
    "inputMint": "SOL",
    "outputMint": "USDC",
    "amount": 1
  }
}
```

预期：

- Zod 校验失败
- 进入 `intent.parse.failed`

## 7. 联调建议

- 每个样例都准备对应 UI 截图期望
- 至少保留一份成功、低置信度、高风险、非法结构样例
- 在没有接通真实 LLM 前，可先用这些载荷驱动前端和状态机
