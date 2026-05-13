# SIP 仓库结构约定

## 1. 目标

本文件定义 SIP 推荐的仓库组织方式，目标是让扩展端、共享类型、本地 Wasm 和外部服务适配保持清晰边界。

## 2. 推荐顶层结构

```text
sip-project/
├── extension/
├── core-engine/
├── services/
├── docs/
├── openspec/
└── scripts/
```

## 3. 目录职责

### 3.1 `extension/`

Chrome 扩展主工程，包含：

- `content/`: 页面感知逻辑
- `background/`: 编排、消息中转、状态缓存
- `sidepanel/`: React UI
- `shared/`: 运行时共享类型和 helper

### 3.2 `core-engine/`

Rust/Wasm 核心库，包含：

- 风险扫描逻辑
- 原始账户数据解析
- 纯函数型安全报告输出

### 3.3 `services/`

外部服务适配层，包含：

- LLM prompt 与解析封装
- Jupiter、RPC、模拟、钱包适配
- 未来可扩展的 metadata provider

### 3.4 `docs/`

正式项目文档目录，作为稳定知识源。

### 3.5 `openspec/`

变更提案、规格与任务追踪目录。

### 3.6 `scripts/`

开发脚本，例如：

- Wasm 构建脚本
- 类型生成脚本
- 本地打包或校验脚本

## 4. `extension/src` 推荐结构

```text
extension/src/
├── content/
│   ├── detect-context.ts
│   └── selectors.ts
├── background/
│   ├── message-router.ts
│   ├── workflow-engine.ts
│   └── stores/
├── sidepanel/
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── state/
├── shared/
│   ├── intent.ts
│   ├── messages.ts
│   ├── workflow.ts
│   └── formatting.ts
└── lib/
    ├── rpc/
    ├── wallet/
    └── telemetry/
```

## 5. 依赖方向约束

- `content/` 只能依赖 `shared/` 和少量平台 helper
- `sidepanel/` 可以依赖 `shared/` 和本地 UI primitives，但不要直接依赖 `content/`
- `background/` 负责协调 `services/` 和 `core-engine` 的桥接
- `shared/` 不依赖上层运行时实现
- `core-engine/` 不依赖 React、Chrome API 或 UI 代码

## 6. 命名建议

- 类型文件优先用名词：`intent.ts`、`messages.ts`
- 编排文件用动词或角色：`workflow-engine.ts`、`message-router.ts`
- 组件文件与导出组件同名：`ActionCard.tsx`
- Hook 统一以 `use` 开头

## 7. 何时拆包

MVP 阶段不建议过早拆成 monorepo 多包，先保证目录边界清晰即可。

当出现以下情况时可考虑拆分：

- `shared/` 类型被多个运行时或工具复用
- `core-engine/` 需要独立发布或单独测试
- `services/` 中的适配逻辑明显膨胀

## 8. 最小落地建议

如果要尽快开工，最小结构至少保证：

- `extension/src/shared/messages.ts`
- `extension/src/shared/intent.ts`
- `extension/src/background/workflow-engine.ts`
- `extension/src/sidepanel/pages/SidePanelPage.tsx`
- `core-engine/src/lib.rs`
