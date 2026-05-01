# 设计规格书：Blink 风格 UI/UX 全面升级 (Direction A)

## 1. 目标
将 Solana Intent Pilot (SIP) 的侧边栏交互体验提升到“Blink 风格”的高度。核心目标是通过视觉冲击力强、信息集成度高的 Action Card，为用户提供直观、安全且有趣的交易体验。

## 2. 核心特性 (BC D)
- **A. 极致卡片化布局 (Action Cards)**: 采用垂直堆叠架构，整合意图、风险、预览和操作。
- **B. 资产变化预览 (Balance Change)**: 直观展示交易前后的余额变化。
- **C. Wasm 风控视觉增强 (Risk Indicator)**: 强化红/黄/绿视觉分级，增加“蓝光扫描”动效。
- **D. 动效与交互细节 (Framer Motion)**: 弹性滑入、成功态 Confetti、加载反馈。

## 3. 视觉规范
- **风格**: 深色模式 (Dark Mode)，背景 `#020617`。
- **配色**:
  - 主色 (Solana Purple): `#9945FF`
  - 成功/安全 (Solana Green): `#14F195`
  - 危险/预警 (Danger Red): `#FF4B4B`
- **字体**: `Inter` (正文), `JetBrains Mono` (数据/地址)。

## 4. 详细设计 (方案 A：垂直堆叠)

### 4.1 ActionCard 组件架构
- **Header**: 显示协议来源 (如 Jupiter) 和交易类型。
- **Balance Area**: 
  - 格式: `[Input Amount] [Symbol] ➔ [Output Amount] [Symbol]`
  - 视觉: 使用大字号和代币图标。
- **Risk Indicator**:
  - 低风险: 绿色边框 + 渐变阴影。
  - 高风险: 红色闪烁边框 + 预警文案。
- **Preview Detail**: 紧凑显示滑点和手续费。
- **CTA Button**: 
  - 状态 A (就绪): 渐变背景 `linear-gradient(90deg, #9945FF, #14F195)`。
  - 状态 B (高风险): 实色红色 `#FF4B4B`。
  - 状态 C (签署中): 旋转 Loading 图标。

### 4.2 交互与动画 (Framer Motion)
- **Entrance**: `initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}`，带有 `type: "spring"`。
- **Scan Ray**: 在 `WorkflowPhase === "risk-checking"` 时，在风险条上方循环播放从左至右的透明蓝光渐变。
- **Success Feedback**: 交易确认后，触发 `canvas-confetti`。

## 5. 技术实现
- **UI 框架**: React + Vanilla CSS。
- **动画库**: `framer-motion`。
- **特效库**: `canvas-confetti`。
- **图标**: `lucide-react`。

## 6. 修改范围
- `extension/src/sidepanel/components/ActionCard.tsx`: 重构为新的模块化布局。
- `extension/src/sidepanel/styles.css`: 增加动画关键帧和全局样式。
- `extension/src/sidepanel/pages/SidePanelPage.tsx`: 适配新的状态传递。

## 7. 验收标准
- [ ] Action Card 在侧边栏中平滑滑入。
- [ ] 风险等级的变化能实时反映在卡片的颜色和按钮状态上。
- [ ] 成功提交交易后，五彩纸屑特效正常触发。
- [ ] 资产变化预览能够正确解析并展示代币符号。
