/**
 * Headless Primitives — Layer 2
 * 只管行为语义，不管颜色/样式
 * 类比 Radix UI — 管弹窗开关；这里管 PRVSE 语义关系的开关
 */

// ── 边约束行为 ────────────────────────────────────────────────────
/**
 * usePRVSEConstraint
 * 描述一条边的行为语义：是否制约、方向性、是否需要 × 标记
 */
export function usePRVSEConstraint(constraintType: string) {
  const isConstraint = constraintType === 'constraint' || constraintType === 'mutual_constraint'
  return {
    isConstraint,
    isBidirectional:  constraintType === 'mutual_constraint',
    showCrossMarker:  isConstraint,
    isDashed:         constraintType === 'contains' || constraintType === 'signal',
    isThick:          constraintType === 'derives',
    /** 是否阻断目标节点（制约语义上 B 被 A 限制） */
    blocks:           constraintType === 'constraint',
    /** 两节点互相影响 */
    mutual:           constraintType === 'mutual_constraint',
  }
}

// ── 权限层门控行为 ────────────────────────────────────────────────
/**
 * useLayerPermission
 * 控制内容可见性 — 低层看不到高层（lN不可见l(N+1)+）
 */
export function useLayerPermission(userLevel: number) {
  return {
    canView:   (layerPerm: number) => userLevel >= layerPerm,
    locked:    (layerPerm: number) => userLevel < layerPerm,
    canViewL0: userLevel >= 0,
    canViewL1: userLevel >= 1,
    canViewL2: userLevel >= 2,
    /** 最高可访问层 id */
    maxLayer:  userLevel >= 2 ? 'l2' : userLevel >= 1 ? 'l1' : 'l0',
  }
}

// ── Reward 阈值行为 ───────────────────────────────────────────────
/**
 * useRewardGate
 * slider 语义：0=矛盾/对立，1=统一/融合
 * threshold 默认 0.7（V节点 l₂ 主观分布规范）
 */
export function useRewardGate(value: number, threshold = 0.7) {
  const pct = Math.round(value * 100)
  return {
    value,
    pct,
    met:      value >= threshold,
    /** 语义标签 */
    label:    value < 0.3 ? '矛盾/对立' : value > 0.7 ? '统一/融合' : '中性',
    /** 短标签（用于徽章） */
    shortLabel: value < 0.3 ? '矛盾' : value > 0.7 ? '统一' : '中性',
    /** Reward 评估结果 */
    reward:   value >= threshold ? 'pass' : 'pending',
  }
}

// ── 节点选中/悬停状态 ──────────────────────────────────────────────
/**
 * useNodeInteraction
 * 节点的选中、悬停、连线源三态行为
 */
export function useNodeInteraction(nodeId: string, selectedId: string | null, linkingId: string | null) {
  return {
    isSelected:  selectedId === nodeId,
    isLinkSource: linkingId === nodeId,
    isActive:    selectedId === nodeId || linkingId === nodeId,
    /** 拖拽时 cursor */
    cursor:      linkingId ? 'crosshair' : 'grab',
  }
}

// ── 折叠状态（用于 LayerSection） ────────────────────────────────
/**
 * useCollapsible
 * 折叠/展开行为，自顶向下可见规则
 */
export function useCollapsible(defaultOpen = true) {
  // 返回初始值，组件内用 useState 管理实际状态
  return { defaultOpen }
}
