# SIP 消息流设计

## 1. 目标

SIP 的消息流需要解决三件事：

- 在 Chrome 扩展多个运行上下文之间稳定同步状态
- 让页面感知、意图推理、风险校验和执行流程可串联
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
type ContextDetectedMessage = {
  type: "context.detected";
  payload: DetectedContextSnapshot;
};
```

### 3.2 用户意图请求消息

```ts
type IntentParseRequestedMessage = {
  type: "intent.parse.requested";
  payload: {
    requestId: string;
    tabId: number;
    userInput: string;
    contextSnapshot: DetectedContextSnapshot;
    userPublicKey?: string;
  };
};
```

### 3.3 风险扫描请求消息

```ts
type RiskScanRequestedMessage = {
  type: "risk.scan.requested";
  payload: {
    requestId: string;
    mintAddress: string;
    sourceAction: SIPAction;
  };
};
```

说明：

- 当前风险扫描请求按动作边界携带最小可信输入
- 不再假设存在顶层 `SIPIntent.payload`

### 3.4 执行预览消息

```ts
type ExecutionPreviewReadyMessage = {
  type: "execution.preview.ready";
  payload: ExecutionPreview;
};
```

### 3.5 状态更新消息

```ts
type WorkflowStateMessage = {
  type: "workflow.state.changed";
  payload: {
    requestId: string;
    phase: WorkflowPhase;
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
2. Background 解析用户输入并生成 `SIPIntent`
3. `SIPIntent` 以 `intentId + actions[] + mode + metadata` 结构在系统内流转
4. 若 `needsClarification = true`，Background 回到 `idle` 并保留澄清信息
5. 若需要风险扫描，Background 基于相关动作发出 `risk.scan.requested`
6. 风险通过后进入报价与模拟阶段
7. 生成 `execution.preview.ready`
8. 只有当预览满足签名前最小可解释条件时，状态才进入 `awaiting-signature`
9. 用户确认后进入签名和提交状态

### 4.3 Bundle 请求

当 `mode = "ATOMIC_BUNDLE"` 时：

- 多个 `SIPAction` 共享同一个 `requestId`
- `background` 仍然是唯一工作流编排者
- 所有动作都拿到中间执行产物，并不自动等于“可以签名”
- 只有当前请求拥有一致的 bundle 预览结果后，才允许进入 `awaiting-signature`

### 4.4 错误、阻断和降级流程

- Intent 结构不合法：进入 `failed`
- 需要澄清：回到 `idle`，但保留澄清信息
- 风险过高：进入 `blocked`
- quote 或 simulate 失败：进入 `failed` 或显式降级路径
- 显式 fallback 允许存在，但不得伪装成已验证成功
- 用户取消签名：回退到 `idle` 或保留最近预览

生产约束：

- 默认解析链在生产环境不得于 LLM 失败后回退到 mock intent
- 默认钱包提交流程在生产环境不得于缺失 wallet provider 时回退到 mock wallet
- 默认 bundle simulation 在生产环境不得于失败后回退到 mock-success

## 5. 设计原则

- 所有异步流程必须带 `requestId`
- Side Panel 只消费状态和结果，不直接持有底层执行逻辑
- Background 是主编排层，减少多个页面上下文各自请求外部服务
- 消息 payload 尽量使用可序列化纯数据，避免传递复杂对象引用
- `actions / bundle` 是当前消息流设计的权威模型

## 6. 推荐共享类型文件

建议在 `extension/src/shared/messages.ts` 中统一定义：

- message type 常量
- payload 类型
- request/response 包装结构
- 状态机枚举

这样可以让 Content Script、Background 和 Side Panel 共用同一套契约。
