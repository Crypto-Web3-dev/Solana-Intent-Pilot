# Repair Log

本文件用于记录项目中的所有修复、优化与重构记录，防止重复问题。

| 2026-04-21 | 钱包 | 确认按钮无法调起钱包签名 | 增加日志跟踪与注入上下文修复 (MAIN world)，并增加 host_permissions | 已完成 |
| 2026-04-21 | 核心 | CSP 违规报错 | 将内联脚本注入改为 Plasmo Main World Content Script (main-bridge.ts) | 已完成 |
| 2026-04-21 | 核心 | 钱包不弹出与网络访问失败 | 将 API 代理改为 Background 直接 fetch，将钱包唤起改为 sidepanel 核心 executeScript (MAIN) 直连 | 已完成 |
| 2026-04-21 | 核心 | 签名报错 r.serialize | 通过交易对象伪装 (Duck Typing) 解决 Versioned Transaction 在无 web3 环境下的签名问题 | 已完成 |
| 2026-04-21 | UI | 界面文案去 Mock 化 | 移除 Submit Intent 和 Cancel 按钮中的 Mock 字样，对齐真实执行路径 | 已完成 |
| 2026-04-21 | 核心 | Jupiter V2 适配 | 对齐 Jupiter Swap V2 GET 接口、taker 参数及 x-api-key 认证 | 已完成 |
| 2026-04-21 | 核心 | Wasm 风控引擎落地 (Phase C) | 修复 rustup 环境并编译 Rust 逻辑，通过 Plasmo url scheme 将真实 Wasm 二进制流集成至插件后台 | 已完成 |
| 2026-04-21 | 核心 | 工程收口与测试修复 (Phase E) | 更新过时的测试用例，解除 Vite Wasm 环境冲突，清理过期 mock，全量 88 个测试通过 | 已完成 |
| 2026-04-21 | UI | 确认后界面卡死在 Waiting 状态 | 修复 useSidePanelState 中的 confirmSignature 逻辑，确保结算后解除 isSigning 状态 | 已完成 |
| 2026-04-21 | 核心 | 真实执行闭环优化 | 实现 ChromeRuntimeMessageRouter 代理，将 UI 状态机同步至 Background 编排层，补全回退路径 | 已完成 |
| 2026-04-21 | 核心 | 接口重构引起测试失败 | 修复 quote-adapter.ts 接口定义与测试用例不匹配的问题 (getOrder 替换 getQuote) | 已完成 |
