# SIP 消息流设计

## 1. 目标

SIP 的消息流需要解决三件事：

- 在 Chrome 扩展多个运行上下文之间稳定同步状态
- 让页面感知、AI 推理、风险校验和执行流程可串联
- 避免让 UI 直接依赖复杂异步逻辑或外部接口细节

## 2. 运行上下文

SIP 的主要消息参与方如下：

- `content script`: 负责页面感知和上下文提取
- `background worker`: 负责消息中转、长生命周期状态与外部请求编排
- `side panel`: 负责展示 UI、接收用户输入、驱动交互
- `wasm engine`: 负责本地风险扫描
- `llm service`: 负责结构化意图推理
- `execution adapter`: 负责报价、模拟、签名和发送交易

## 3. 核心消息类型

### 3.1 页面感知消息

```ts
type DetectedContextMessage = {
  type: "context.detected";
  payload: {
    tabId: number;
    url: string;
    title: string;
    selectedText?: string;
    detectedTokens: Array<{
      symbol?: string;
      mint?: string;
      source: "twitter" | "birdeye" | "dexscreener" | "generic";
      confidence: number;
    }>;
    rawHints: string[];
    detectedAt: string;
  };
};
```

用途：

- 从 Content Script 发送到 Background
- 再由 Background 广播给 Side Panel

### 3.2 用户意图请求消息

```ts
type IntentParseRequestedMessage = {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
  };
};
```

用途：

- 从 Side Panel 发起
- 由 Background 统一处理，并在内部调用 AI service

### 3.3 风险扫描请求消息

```ts
type RiskScanRequestedMessage = {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    accountDataBase64?: string;
    sourceIntent: SIPIntent["payload"];
  };
};
```

### 3.4 执行预览消息

```ts
type ExecutionPreviewReadyMessage = {
  type: "execution.preview.ready";
  payload: {
    requestId: string;
    routeLabel: string;
    inputAmount: string;
    outputAmount: string;
    slippageBps: number;
    estimatedFeeLamports: string;
    simulationSummary?: string;
  };
};
```

### 3.5 状态更新消息

```ts
type WorkflowStateMessage = {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase:
      | "idle"
      | "detecting"
      | "parsing"
      | "risk-checking"
      | "quoting"
      | "simulating"
      | "awaiting-signature"
      | "submitting"
      | "confirmed"
      | "failed"
      | "blocked";
    reason?: WorkflowReason | string;
  };
};
```

## 4. 主流程编排

### 4.1 感知流程

1. Content Script 扫描页面并生成 `context.detected`
2. Background 存储最新上下文快照
3. Side Panel 订阅并渲染 Detection Bar 和上下文卡片

### 4.2 意图执行流程

1. Side Panel 发送 `intent.parse.requested`
2. Background 调用 LLM service
3. LLM 返回 Intent 后发出 `workflow.state.changed(parsing -> risk-checking)`
4. Background 发出 `risk.scan.requested`
5. 风险扫描完成后，如果通过则进入报价与模拟阶段
6. 生成 `execution.preview.ready`
7. 用户确认后进入签名和提交状态

### 4.3 错误和阻断流程

- LLM 输出不合法：进入 `failed`
- 风险过高：进入 `blocked`
- 报价失败或 RPC 拥堵：进入 `failed`，附带 fallback 提示
- 用户取消签名：回退到 `idle` 或保留最近预览

## 5. 设计原则

- 所有异步流程必须带 `requestId`
- Side Panel 只消费状态和结果，不直接持有底层执行逻辑
- Background 是主编排层，减少多个页面上下文各自请求外部服务
- 消息 payload 尽量使用可序列化纯数据，避免传递复杂对象引用

## 6. 推荐共享类型文件

建议在 `extension/src/shared/messages.ts` 中统一定义：

- message type 常量
- payload 类型
- request/response 包装结构
- 状态机枚举

这样可以让 Content Script、Background 和 Side Panel 共用同一套契约。
