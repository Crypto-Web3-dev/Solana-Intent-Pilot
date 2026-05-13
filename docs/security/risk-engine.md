# SIP 风险引擎设计

## 1. 目标

SIP 风险引擎用于在交易执行前提供浏览器本地的基础安全校验，减少把安全判断完全交给云端模型的风险。

MVP 阶段重点不是做完整审计系统，而是快速识别高风险代币和明显异常状态。

## 2. 设计原则

- 风险引擎运行在本地 Wasm 环境
- 输出结构必须简单、稳定、可被 UI 直接消费
- 高风险应默认阻断，避免“已发现问题仍无提示”
- 评分逻辑优先明确可解释，而不是追求复杂模型

## 3. 输入与输出

### 3.1 输入

- Mint 账户原始字节数据
- 目标 token mint 地址
- 可选的流动性、持仓和模拟辅助数据

### 3.2 输出

```ts
export interface SecurityReport {
  score: number;
  level: "low" | "medium" | "high" | "unknown";
  blocking: boolean;
  checks: Array<{
    key: string;
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
  summary: string;
}
```

## 4. MVP 检查项

### 4.1 Mint Authority

- 存在时视为高风险候选
- 因为项目方可能继续增发代币

### 4.2 Freeze Authority

- 存在时至少给出警告
- MVP 中默认给出警告，不单独作为阻断条件

### 4.3 Liquidity 基础检查

- 如果能拿到流动性池信息，则检查是否过低
- 在缺失数据时不要伪造“安全”，应标为 `unknown`

### 4.4 持仓集中度

- 如果可获取 top holders 数据，则检查是否过度集中
- 在 MVP 中可作为加分项，不一定阻断

## 5. 评分建议

可以采用简单扣分模型：

- 初始分：`100`
- 存在 Mint Authority：`-60`
- 存在 Freeze Authority：`-30`
- 流动性过低：`-20`
- 持仓过于集中：`-20`

建议级别：

- `80-100`: `low`
- `50-79`: `medium`
- `<50`: `high`
- 关键数据缺失且无法完成最低检查覆盖：`unknown`

建议阻断策略：

- 命中明确阻断规则时优先阻断，例如 `Mint Authority`
- 未命中明确阻断规则时，可在 `score < 50` 时阻断
- `unknown` 默认不直接映射为 `high`，但必须通过 UI 明示“数据不足”

## 6. Rust 模块边界

建议 Wasm 暴露纯函数接口，不耦合 UI 或网络请求：

```rust
#[wasm_bindgen]
pub fn analyze_mint_data(data: &[u8]) -> Result<JsValue, JsValue>;
```

Rust 负责：

- 解析原始数据
- 计算风险分值
- 返回结构化报告

JS/TS 负责：

- 获取 RPC 数据
- 调用 Wasm
- 将结果映射到 UI 标签和状态机

## 7. UI 映射建议

- `low`: 绿色盾牌，可正常继续
- `medium`: 黄色提示，可继续但需明确告知风险
- `high`: 红色警告，默认阻断
- `unknown`: 中性或黄色提示，不得伪装成已通过检查

Action Card 应根据 `blocking` 决定：

- 禁用主 CTA
- MVP 默认只展示取消或返回，不开放高风险 override
- 高亮说明具体失败检查项

## 8. 后续扩展方向

- 增加 simulateTransaction 的 balance diff 风险解释
- 引入协议级黑名单或信誉名单
- 接入多源流动性和 holder 数据
- 对不同意图类型使用不同风险策略
