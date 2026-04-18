# SIP 前端组件架构

## 1. 目标

前端组件架构需要支持三件事：

- Side Panel 中的复杂状态展示
- AI、风险扫描和执行流程的连续反馈
- 后续快速替换视觉样式而不破坏业务边界

## 2. 页面结构

建议 Side Panel 入口页面拆为：

- `SidePanelPage`: 顶层容器，负责状态订阅和布局编排
- `HeaderBar`: 品牌、钱包状态、网络状态
- `DetectionBar`: 页面感知提醒条
- `ChatThread`: 对话和系统消息流
- `ActionCardStack`: 一个或多个执行卡片
- `Composer`: 输入框和快捷动作

## 3. 组件分层

### 3.1 Shell 层

负责页面布局和上下文装配：

- `SidePanelPage`
- `AppShell`
- `PanelSection`

### 3.2 Domain 组件层

负责承载具体业务对象：

- `IntentSummaryCard`
- `RiskIndicator`
- `ActionCard`
- `ExecutionStatusBanner`
- `WalletStatusChip`

### 3.3 Primitive 层

负责复用基础 UI：

- `Button`
- `Card`
- `Badge`
- `Progress`
- `Tooltip`
- `EmptyState`

## 4. 建议目录

```text
src/sidepanel/
├── pages/
│   └── SidePanelPage.tsx
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx
│   │   └── HeaderBar.tsx
│   ├── context/
│   │   └── DetectionBar.tsx
│   ├── chat/
│   │   ├── ChatThread.tsx
│   │   ├── MessageBubble.tsx
│   │   └── Composer.tsx
│   ├── action/
│   │   ├── ActionCard.tsx
│   │   ├── IntentSummaryCard.tsx
│   │   └── ExecutionStatusBanner.tsx
│   ├── risk/
│   │   └── RiskIndicator.tsx
│   └── primitives/
│       ├── Button.tsx
│       ├── Card.tsx
│       └── Badge.tsx
└── hooks/
    ├── useSidePanelState.ts
    ├── useIntentWorkflow.ts
    └── useRiskScan.ts
```

## 5. 状态管理建议

### 5.1 顶层状态

建议集中在 `useSidePanelState` 或轻量 store 中管理：

- 当前页面上下文
- 最近一次 intent 请求
- 风险扫描结果
- 交易预览结果
- 工作流状态机

### 5.2 局部状态

适合留在组件内部：

- 输入框文本
- tooltip 开合
- 卡片折叠展开
- 局部 hover / loading 视觉状态

## 6. 组件契约建议

### 6.1 ActionCard

建议 props：

```ts
type ActionCardProps = {
  routeLabel: string;
  inputToken: { symbol: string; amount: string };
  outputToken: { symbol: string; amount: string };
  riskLevel: "low" | "medium" | "high" | "unknown";
  blocked: boolean;
  simulationSummary?: string;
  status:
    | "idle"
    | "quoting"
    | "simulating"
    | "awaiting-signature"
    | "submitting"
    | "confirmed"
    | "blocked"
    | "failed";
  onConfirm: () => void;
  onCancel: () => void;
};
```

### 6.2 RiskIndicator

建议 props：

```ts
type RiskIndicatorProps = {
  score: number;
  level: "low" | "medium" | "high" | "unknown";
  checks: Array<{
    label: string;
    status: "pass" | "warn" | "fail";
    detail: string;
  }>;
};
```

## 7. Hook 边界建议

- `useIntentWorkflow`: 负责消费 Background 工作流状态，并将用户动作转成消息
- `useRiskScan`: 封装 Wasm 初始化与调用
- `useWalletState`: 负责连接状态与签名入口
- `useDetectedContext`: 订阅 Background 广播的页面感知结果

不要让展示组件自己调用 RPC、LLM 或 Wasm。

补充约束：

- 运行时主编排放在 `background/workflow-engine.ts`
- `sidepanel/` 中的 hooks 只负责订阅、映射和触发消息，不维护第二套独立状态机
- 组件状态命名应尽量与全局 workflow state 对齐，避免 `success/error/signing` 这类局部别名漂移

## 8. 演进建议

- 先把 Action Card 做成单实例，后续再扩展多卡片堆栈
- 先用轻量状态管理，复杂后再考虑 Zustand 等方案
- 保持业务类型定义与消息协议定义共享，避免前后重复声明
