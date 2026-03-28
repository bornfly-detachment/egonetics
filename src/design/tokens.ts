/**
 * Design Tokens — Layer 1
 * 静态默认值，所有组件的样式 source of truth
 * DB (hm_protocol) 中的 ui_visual 字段可选覆盖这些值
 *
 * 修改样式的两种方式：
 *   1. 改这里 → 重新构建 → 全局生效（开发时用）
 *   2. 改 /protocol 页面对应条目 → 立即生效，不需要重建（运行时用）
 */

export interface NodeToken {
  bg:     string   // 节点背景色（SVG fill）
  border: string   // 节点边框色
  text:   string   // 节点文字/主色
  label:  string   // 节点类型全称
}

export interface LayerToken {
  color:  string   // 主色（文字/高亮）
  bg:     string   // 背景色
  border: string   // 边框色
  icon:   string   // 标识符号
  name:   string   // 层名称
  perm:   number   // 权限级别
}

export interface EdgeToken {
  color:  string   // 线条颜色
  width:  number   // 线宽
  dash:   string   // strokeDasharray（'' = 实线）
  label:  string   // 中文标签
}

export interface InteractionToken {
  color: string
  icon:  string
  label: string
}

export interface DesignTokens {
  node:        Record<string, NodeToken>
  layer:       Record<string, LayerToken>
  edge:        Record<string, EdgeToken>
  interaction: Record<string, InteractionToken>
}

export const DESIGN_TOKENS: DesignTokens = {
  node: {
    P: { bg: '#1a2744', border: '#3b82f6', text: '#93c5fd', label: 'Pattern'   },
    R: { bg: '#221a44', border: '#8b5cf6', text: '#c4b5fd', label: 'Relation'  },
    V: { bg: '#2a200a', border: '#f59e0b', text: '#fcd34d', label: 'Value'     },
    S: { bg: '#0a2a1a', border: '#10b981', text: '#6ee7b7', label: 'State'     },
    E: { bg: '#2a0a0a', border: '#ef4444', text: '#fca5a5', label: 'Evolution' },
  },

  layer: {
    l0: { color: '#93c5fd', bg: '#1a2a44', border: '#3b82f6', icon: '⚡', name: '物理信号层', perm: 0 },
    l1: { color: '#6ee7b7', bg: '#0a2a1a', border: '#10b981', icon: '🔧', name: '客观规律层', perm: 1 },
    l2: { color: '#c4b5fd', bg: '#221a44', border: '#8b5cf6', icon: '🧠', name: '认知演化层', perm: 2 },
  },

  edge: {
    directed:          { color: '#4b5563', width: 1.5, dash: '',    label: '有向' },
    constraint:        { color: '#ef4444', width: 1.5, dash: '',    label: '制约' },
    mutual_constraint: { color: '#ef4444', width: 1.5, dash: '',    label: '互制' },
    contains:          { color: '#4b5563', width: 1.2, dash: '8,3', label: '包含' },
    derives:           { color: '#8b5cf6', width: 2.5, dash: '',    label: '推导' },
    signal:            { color: '#3b82f6', width: 1.2, dash: '4,3', label: '信号' },
  },

  interaction: {
    collapse:           { color: '#3b82f6', icon: '›',  label: '折叠' },
    drag:               { color: '#f59e0b', icon: '⋮⋮', label: '拖拽' },
    click:              { color: '#10b981', icon: '↗',  label: '点击' },
    dblclick:           { color: '#8b5cf6', icon: '✎',  label: '双击' },
    'shortcut-or-plus': { color: '#ec4899', icon: '⊕',  label: '挂载' },
  },
}
