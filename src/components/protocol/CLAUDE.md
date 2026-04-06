# ProtocolView — 交互注册中心

**Slogan**: 注册即存在。未在此注册的交互，不得在 prvse-world 显示。

## 定位
ProtocolView 是前后端交互逻辑库，也是 prvse-world 的动态 UI 注册系统。
- 在此注册的组件/协议 → 自动出现在 prvse-world 的资源管理面板
- 未注册的组件 → 对 prvse-world 不可见
- 相当于 OS 的设备驱动注册表

## 架构职责
1. **协议定义**：定义人机交互的数据结构、消息格式、状态机
2. **组件注册**：将 UI 组件绑定到 prvse-world 的显示槽位
3. **权限声明**：声明组件需要的 T0/T1/T2 访问级别
4. **生命周期钩子**：组件 mount/unmount 时通知 prvse-world

## 当前实现状态
- Protocol Builder 已有基础框架
- prvse-world 动态加载注册组件的机制尚未实现（TODO）
- T0~T2 资源管理 UI 待注册（TODO）

## 对 Agent 的指令
- 新增任何要在 prvse-world 显示的功能，必须先在此文件定义协议
- 协议必须有完整 CRUD（注册/查看/修改/注销）
- 遵循 PRVSE 五层语义：P(角色) R(关系) V(价值) S(状态) E(演化)
