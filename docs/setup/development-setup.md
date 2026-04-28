# SIP 开发环境准备

## 1. 目标

本文件定义 SIP 项目的最小开发环境要求，帮助后续实现时快速建立一致的本地工作环境。

## 2. 基础依赖

建议安装以下工具：

- Node.js 20+
- pnpm 或 npm
- Rust stable toolchain
- `wasm-pack`
- Chrome 或 Chromium
- Phantom 钱包

如果要进行更稳定的 Solana 调试，建议额外准备：

- Solana CLI
- 一个主 RPC 和一个备用 RPC
- 一个可用的 LLM API Key

## 3. 推荐环境变量

建议使用本地环境文件管理敏感配置：

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-oss-120b:free
HELIUS_API_KEY=
PLASMO_PUBLIC_HELIUS_API_KEY=
QUICKNODE_RPC_URL=
FALLBACK_RPC_URL=
JUPITER_API_BASE=https://quote-api.jup.ag
JUPITER_API_KEY=
```

规则：

- 不把真实密钥写进仓库文档或源码
- 浏览器扩展构建会把 `OPENROUTER_API_KEY` 映射为 `PLASMO_PUBLIC_OPENROUTER_API_KEY`
- 区分主节点和备用节点
- 本地和演示环境尽量使用同一套 provider

## 4. 本地开发流程

### 4.1 扩展侧

建议流程：

1. 启动扩展开发模式
2. 在 Chrome 中加载 unpacked extension
3. 打开 Side Panel 并验证基础 UI
4. 检查 Content Script 是否能抓到页面上下文

### 4.2 Wasm 侧

建议流程：

1. 在 `core-engine/` 中编写 Rust 逻辑
2. 使用 `wasm-pack` 构建 Wasm 产物
3. 将输出接入扩展侧加载逻辑
4. 验证最小风险扫描结果是否可返回

### 4.3 服务侧

建议流程：

1. 接入 LLM 解析
2. 用静态样例验证 JSON Intent 结构
3. 接入 Jupiter 报价
4. 验证模拟结果能被 UI 展示

## 5. 最小联调检查

在正式实现前，建议先跑通以下最小链路：

- Side Panel 能渲染
- Content Script 能发送 `context.detected`
- LLM 能输出合法 `SIPIntent`
- Wasm 能返回 `SecurityReport`
- 报价结果能渲染成 Action Card

## 6. 开发规范建议

- 共享类型优先放在 `shared/`
- 所有消息类型先写文档再落代码
- 任何外部调用都要有 timeout 和错误态
- 先跑最小闭环，再扩展多协议和动画效果

## 7. 常见准备风险

- Wasm 在 MV3 下加载受 CSP 影响
- 公共 RPC 容易限流
- LLM 输出不稳定时会卡住整个工作流
- 钱包签名链路需要真实浏览器环境验证

## 8. 完成定义

当以下条件满足时，可认为开发环境准备完成：

- 本地扩展可运行
- 环境变量可被正确读取
- Wasm 构建与加载链路可用
- 主 RPC 与备用 RPC 可访问
- 核心联调链路至少能跑通静态数据版本
