# PRVSE World — Agent Harness OS

**Slogan**: AI Native UI 搭建的 Agent Harness OS，产品艺术追求苹果级极简与创新，大傻子都能用。

## 定位
prvse-world 是 Egonetics 的操作系统层。它不是一个普通页面，而是整个系统的可视化运行时环境：
- 动态显示所有在 ProtocolView 注册过的交互组件
- 管理 T0/T1/T2 执行节点的资源、权限、生命周期
- 物理引擎驱动的空间布局，节点可拖拽、缩放、聚焦

## 架构原则
- **注册驱动**：组件必须先在 Protocol 注册，才能在此显示——无注册不显示
- **极简优先**：每个操作最多 2 步完成，无需阅读文档
- **OS 隐喻**：T0=进程/L0，T1=服务/L1，T2=系统/L2，资源管理类比操作系统

## 当前实现状态
- 物理引擎布局 ✓
- 节点聚焦/Minimap ✓
- FreeCodeTerminal 尚未嵌入（TODO）
- T0~T2 资源可视化尚未实现（TODO）
- 存储管理、权限管理面板尚未实现（TODO）

## 对 Agent 的指令
修改此目录时，必须：
1. 保持视觉极简，不堆砌特效
2. 新增组件先在 ProtocolView 注册
3. 任何资源显示必须有实时数据来源（不允许静态 mock）
