# SIP Docs

本目录用于沉淀 Solana Intent Pilot (SIP) 的正式项目文档，基于 `learn/` 下已有材料整理而成，适合作为后续设计、实现与协作的统一入口。

## 阅读顺序

1. [项目总览](./overview/project-overview.md)
2. [系统架构](./architecture/system-architecture.md)
3. [运行时顺序图](./architecture/runtime-sequence.md)
4. [工作流状态机](./architecture/workflow-state-machine.md)
5. [消息流设计](./architecture/message-flow.md)
6. [Intent 协议](./api/intent-schema.md)
7. [运行时契约总表](./api/runtime-contracts.md)
8. [消息类型定义](./api/message-types.md)
9. [模块拆分](./modules/module-breakdown.md)
10. [仓库结构约定](./modules/repository-structure.md)
11. [风险引擎设计](./security/risk-engine.md)
12. [MVP 风险策略](./security/mvp-risk-policy.md)
13. [信任边界与安全约束](./security/trust-boundaries.md)
14. [界面设计](./design/ui-ux-design.md)
15. [前端组件架构](./design/component-architecture.md)
16. [开发环境准备](./setup/development-setup.md)
17. [Intent 样例载荷](./api/sample-payloads.md)
18. [风险案例库](./security/risk-cases.md)
19. [验收标准](./testing/acceptance-criteria.md)
20. [测试矩阵](./testing/test-matrix.md)
21. [UI 状态映射](./api/ui-state-mapping.md)
22. [阻断规则表](./security/blocking-rules.md)
23. [QA 清单](./testing/qa-checklist.md)
24. [测试报告模板](./testing/test-report-template.md)
25. [Demo 脚本](./roadmap/demo-script.md)
26. [Demo 检查清单](./roadmap/demo-checklist.md)
27. [实施路线图](./roadmap/implementation-roadmap.md)

## 目录结构

- `overview/`: 产品定位、目标用户、核心价值与范围说明
- `architecture/`: 系统分层、运行时链路、关键技术决策
- `api/`: 内部协议、数据结构与接口约束
- `modules/`: 模块职责、边界、通信关系与目录建议
- `security/`: 风险控制、校验逻辑与安全设计
- `design/`: 视觉系统、页面结构、交互流与组件规范
- `setup/`: 开发环境、依赖准备与本地工作方式
- `testing/`: 验收标准、测试策略与 QA 检查项
- `roadmap/`: MVP 交付路径、阶段目标与演示重点

## 文档来源

当前文档主要整理自以下资料：

- `learn/项目文档.md`
- `learn/深度开发规格书.md`
- `learn/模块切分.md`
- `learn/视觉系统.md`

后续如果产品方向或技术方案发生变化，应优先更新本目录，再回写或归档 `learn/` 中的探索性资料。
