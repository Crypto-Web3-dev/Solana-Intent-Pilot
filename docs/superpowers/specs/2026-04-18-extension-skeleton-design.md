# SIP Extension Skeleton Design

## Goal

在当前纯文档仓库的基础上，落出一套可运行的 Chrome extension 最小骨架，覆盖：

- `shared` 运行时类型
- `background` 工作流编排骨架
- `sidepanel` 基础 UI
- `content` 最小上下文检测入口
- 全 mock 的 parse -> risk -> preview 纵向闭环

本设计的目标不是接通真实链路，而是验证当前 `docs/` 中定义的架构、状态机和运行时契约是否真的适合实现。

## Scope

本轮实现包含：

- 新建 `extension/` 代码骨架
- 将文档中的核心契约落成 `shared` 类型文件
- 建立 `background/workflow-engine.ts` 和消息路由骨架
- 建立 `sidepanel` 页面、状态订阅 hook 和最小展示组件
- 建立 `content/detect-context.ts` 的最小消息发送能力
- 用本地 mock 服务跑通 `intent.parse.requested -> workflow.state.changed -> execution.preview.ready`
- 为 `workflow-engine` 和关键类型写最小测试

本轮不包含：

- 真实 LLM 接入
- 真实 Jupiter / RPC 接入
- 真实 Wasm 风险扫描
- 真实钱包签名
- 生产级视觉打磨

## Why This Slice

当前仓库尚无实现代码，直接接真实链路会把“脚手架搭建”和“外部集成调试”混在一起，风险过高。

先做全 mock 纵向切片的价值是：

- 最快验证文档里的边界是否合理
- 先把 `shared -> background -> sidepanel` 的关系钉死
- 让后续真实服务接入变成替换 mock，而不是边搭边改结构
- 让测试优先覆盖状态机和契约，而不是被外部依赖拖住

## Architecture

### Runtime ownership

- `Background` 是唯一主编排层
- `Side Panel` 只负责渲染状态、发送用户动作
- `Content Script` 只负责发送页面上下文线索
- mock 服务只返回稳定对象，不参与 UI 推导

### Vertical flow

第一轮跑通的最小流程：

1. `content` 发送 `context.detected`
2. `sidepanel` 提交 `intent.parse.requested`
3. `background` 调用 mock parse 服务
4. `background` 根据返回结果推进 workflow state
5. `background` 调用 mock risk 服务
6. `background` 调用 mock preview 服务
7. `sidepanel` 订阅状态和结果并渲染

### Key invariants

- `needsClarification` 回到 `idle`，不进入 `blocked`
- `unknown` 是风险标签，不是 workflow phase
- `blocked` 与 `failed` 必须可区分
- 所有跨上下文消息都带 `requestId`
- 所有 UI 消费对象都优先来自 `shared` 稳定类型

## File structure

建议首轮创建如下结构：

```text
extension/
├── package.json
├── tsconfig.json
├── src/
│   ├── shared/
│   │   ├── context.ts
│   │   ├── intent.ts
│   │   ├── risk.ts
│   │   ├── execution.ts
│   │   ├── workflow.ts
│   │   └── messages.ts
│   ├── background/
│   │   ├── workflow-engine.ts
│   │   ├── message-router.ts
│   │   └── mock-services.ts
│   ├── content/
│   │   └── detect-context.ts
│   └── sidepanel/
│       ├── pages/
│       │   └── SidePanelPage.tsx
│       ├── hooks/
│       │   └── useSidePanelState.ts
│       └── components/
│           ├── DetectionBar.tsx
│           ├── IntentSummaryCard.tsx
│           ├── RiskIndicator.tsx
│           └── ActionCard.tsx
└── tests/
    ├── shared/
    └── background/
```

## Component responsibilities

### `shared/`

责任：

- 承载单一事实来源的类型和消息契约
- 不依赖 React、Chrome API 或具体运行时实现

要求：

- 直接对齐 `docs/api/runtime-contracts.md`
- 不在 UI 层重复定义近似类型

### `background/workflow-engine.ts`

责任：

- 维护单请求工作流状态
- 接收 parse / risk / preview 结果并推进状态
- 产出 `workflow.state.changed`

要求：

- 对齐 `docs/architecture/workflow-state-machine.md`
- 不混入 UI 文案
- 优先使用纯函数和小接口，便于测试

### `background/mock-services.ts`

责任：

- 返回稳定的 mock intent、mock risk、mock preview

要求：

- 返回值必须符合 `shared` 类型
- 至少覆盖 3 条路径：
  - happy path
  - `needsClarification`
  - `blocked`

### `background/message-router.ts`

责任：

- 接收来自 content / sidepanel 的消息
- 调用 workflow engine 和 mock services
- 广播更新后的状态与结果

### `content/detect-context.ts`

责任：

- 发送一份最小 `DetectedContextSnapshot`

要求：

- 首轮可以使用静态或半静态数据
- 不在本轮实现复杂 DOM 平台适配

### `sidepanel`

责任：

- 展示 workflow state、intent 摘要、风险信息和预览信息
- 提供输入框与触发动作

要求：

- 不自己推导 workflow phase
- UI 先追求语义正确，不追求最终视觉

## Data flow

### Happy path

1. 用户输入命令
2. `sidepanel` 发送 `intent.parse.requested`
3. `background` 进入 `parsing`
4. mock parse 返回合法 `SIPIntent`
5. `background` 进入 `risk-checking`
6. mock risk 返回 `low` 或 `medium`
7. `background` 进入 `quoting -> simulating`
8. mock preview 返回 `ExecutionPreview`
9. `background` 进入 `awaiting-signature`
10. `sidepanel` 显示完整卡片

### Clarification path

1. mock parse 返回 `needsClarification = true`
2. `background` 回到 `idle`
3. `sidepanel` 保留摘要并提示用户补充信息

### Blocked path

1. mock risk 返回 `blocking = true`
2. `background` 进入 `blocked`
3. `sidepanel` 显示阻断原因并禁用主 CTA

## Error handling

第一轮至少支持以下错误分支：

- parse 返回结构非法 -> `failed`
- preview mock 主动抛错 -> `failed`
- 用户取消或重置 -> 回到 `idle`

要求：

- `failed` 和 `blocked` 视觉区分
- 错误原因由 `background` 提供，不由组件自行猜测

## Testing strategy

本轮采用最小 TDD：

### `shared`

- 校验关键类型导出是否存在
- 校验消息联合类型可覆盖核心消息

### `workflow-engine`

- happy path 从 `parsing` 进入 `awaiting-signature`
- `needsClarification` 从 `parsing` 回到 `idle`
- `blocking = true` 从 `risk-checking` 进入 `blocked`
- preview 失败时进入 `failed`

### UI

本轮只做轻量测试或最小渲染断言，重点先保证：

- `unknown` 不显示为成功
- `blocked` 与 `failed` 可区分

## Success criteria

当以下条件满足时，视为本轮完成：

- `extension/` 骨架可安装或至少可构建
- `shared` 类型与文档契约一致
- mock 工作流能驱动 `sidepanel` 展示 3 条路径
- 状态机关键测试通过
- 没有把真实链路和骨架搭建耦合在一起

## Risks

### Risk 1: 工程脚手架细节过早分散注意力

缓解：

- 先保证目录、类型、消息和状态机正确
- 尽量少引入额外依赖

### Risk 2: UI 先写太多，反而把状态边界写乱

缓解：

- 先让 `background` 产出稳定对象
- `sidepanel` 只做订阅和渲染

### Risk 3: mock 数据与真实链路差距过大

缓解：

- 所有 mock 返回值严格遵守 `runtime-contracts.md`
- 不使用 UI 专用 shape

## Out of scope follow-ups

本轮完成后，下一阶段再接：

- 真实 LLM parse service
- 真实 risk/Wasm adapter
- 真实 quote/simulate adapter
- 钱包签名链路
- 更强的 UI 视觉系统
