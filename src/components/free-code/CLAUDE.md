# FreeCodeTerminal — 执行节点原生状态

**Slogan**: L0/L1 具有生命周期的执行节点的原生状态。Debug 与开发的真实战场。

## 定位
FreeCodeTerminal 是 T0/T1/T2 执行节点的 CLI 调试界面，暴露各 tier 的原生运行状态。
- T0 = 本地 Qwen，零成本，数据不出本机
- T1 = MiniMax 云端推理，Anthropic 协议兼容
- T2 = Claude Max，host 身份，全权访问

## 当前实现局限（权宜之计）
- xterm.js 外壳是临时方案，PTY echo 问题尚存
- free-code CLI 本身过于臃肿，后续需要精简或替换
- 与 PRVSE 宪法/规则体系尚未对接
- 缺少编译器层、物理引擎集成

## 必须对接的系统（TODO）
1. **规则宪法**：`~/.claude/constitution/` — 每个 tier 应加载对应级别的宪法约束
2. **PRVSE 协议**：执行节点的输入输出应符合 PRVSE 五层语义标签
3. **编译器**：自然语言 → 结构化任务的转换层
4. **物理引擎**：执行状态可在 prvse-world 里空间可视化

## 对 Agent 的指令
- 此页面是调试工具，不是最终产品形态
- 修改 xterm/PTY 相关代码时极度保守，先验证再改
- 任何对 free-code 二进制的修改必须在隔离环境测试
- 后续重构方向：用更轻量的终端替代 xterm，或完全用自定义 UI 替代 CLI
