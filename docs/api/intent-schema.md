# SIP Intent 协议

## 1. 目标

Intent 协议是 SIP 的核心契约，用于连接：

- 用户自然语言输入
- LLM 结构化推理
- 本地风险引擎
- 报价、模拟与链上执行模块

协议的关键目标是可校验、可演进、可落地执行。

## 2. 顶层结构

```json
{
  "intent": "SWAP",
  "confidence": 0.98,
  "payload": {
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "amount": "1000000000",
    "amountMode": "exact",
    "slippageBps": 50,
    "platform": "Jupiter"
  },
  "metadata": {
    "reasoning": "Swap SOL to USDC via the best available route.",
    "requiresRiskScan": true,
    "sourceContext": ["page-token", "selected-text"],
    "needsClarification": false
  }
}
```

## 3. 字段定义

### 3.1 `intent`

支持值：

- `SWAP`
- `LEND`
- `STAKE`
- `TRANSFER`

MVP 建议先只真正执行 `SWAP`，其它值可先保留为扩展位。

### 3.2 `confidence`

- 取值范围：`0` 到 `1`
- 用于判断是否需要二次确认或澄清
- 建议阈值：
  - `>= 0.85`: 可直接进入风险扫描
  - `0.5 - 0.85`: 需要 UI 明示“低置信度”
  - `< 0.5`: 先提示澄清，不直接执行

### 3.3 `payload`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `inputMint` | `string` | 输入资产 mint |
| `outputMint` | `string` | 输出资产 mint |
| `amount` | `string` | 原子单位数量，避免浮点误差 |
| `amountMode` | `"exact" | "half" | "all"` | 数量来源 |
| `slippageBps` | `number` | 滑点，单位 bps |
| `platform` | `string` | 执行协议，例如 `Jupiter` |

### 3.4 `metadata`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `reasoning` | `string` | 给 UI 展示的简短解释 |
| `requiresRiskScan` | `boolean` | 是否需要本地风险扫描 |
| `sourceContext` | `string[]` | 说明本次推理用了哪些上下文来源 |
| `needsClarification` | `boolean` | 是否需要用户补充目标对象、数量或条件 |

## 4. TypeScript 参考定义

```ts
export type IntentType = "SWAP" | "LEND" | "STAKE" | "TRANSFER";

export type AmountMode = "exact" | "half" | "all";

export interface SIPIntent {
  intent: IntentType;
  confidence: number;
  payload: {
    inputMint: string;
    outputMint: string;
    amount: string;
    amountMode: AmountMode;
    slippageBps: number;
    platform: string;
  };
  metadata: {
    reasoning: string;
    requiresRiskScan: boolean;
    sourceContext: string[];
    needsClarification: boolean;
  };
}
```

## 5. 校验要求

建议在接入层做两层校验：

### 5.1 结构校验

- JSON 必须完整且可解析
- `intent` 必须在枚举中
- `amount` 必须是字符串形式的非负整数
- `slippageBps` 必须在合理范围，例如 `1-500`

### 5.2 业务校验

- `inputMint` 与 `outputMint` 不能相同
- `outputMint` 必须与页面上下文或 token registry 可对齐
- `confidence` 过低时不能直接进入执行链
- `needsClarification = true` 时不能直接进入报价和签名链
- `requiresRiskScan` 为 `true` 时必须先经过风控

## 6. Zod 参考

```ts
import { z } from "zod";

export const sipIntentSchema = z.object({
  intent: z.enum(["SWAP", "LEND", "STAKE", "TRANSFER"]),
  confidence: z.number().min(0).max(1),
  payload: z.object({
    inputMint: z.string().min(32),
    outputMint: z.string().min(32),
    amount: z.string().regex(/^\d+$/),
    amountMode: z.enum(["exact", "half", "all"]).default("exact"),
    slippageBps: z.number().int().min(1).max(500),
    platform: z.string().min(1)
  }),
  metadata: z.object({
    reasoning: z.string().min(1),
    requiresRiskScan: z.boolean(),
    sourceContext: z.array(z.string()).default([]),
    needsClarification: z.boolean().default(false)
  })
});
```

## 7. 版本演进建议

- 当前协议建议标记为 `v0`
- 将来新增字段时优先向后兼容
- 如果要引入多步复合动作，建议新增 `steps[]` 而不是直接破坏现有 payload 结构

## 8. UI 使用建议

- `metadata.reasoning` 用作 AI 卡片摘要
- `confidence` 决定是否展示低置信度提示
- `amountMode` 用于提示用户金额是推断值还是明确值
- `requiresRiskScan` 决定是否先展示扫描中态
- `needsClarification` 用于表达“结构合法，但还不能继续执行”
