/**
 * PRVSE World — Constants
 *
 * Visual parameters, zoom thresholds, and color mappings.
 * Root entities = 3 human control dimensions: 宪法 / 资源 / 目标
 */

/** Root entity colors — the 3 control dimensions */
export const ROOT_COLORS: Record<string, string> = {
  'dim-constitution': '#e63333',  // 宪法 — 红 (红黄蓝三原色)
  'dim-resources':    '#e6c833',  // 资源 — 黄 (红黄蓝三原色)
  'dim-goals':        '#3366e6',  // 目标 — 蓝 (红黄蓝三原色)
}

/** Root entity labels for 3D display — language-aware */
import type { Language } from '@/lib/translations'
import { translations } from '@/lib/translations'

export function getRootLabels(lang: Language): Record<string, string> {
  const d = translations[lang].prvse.dimensions
  return {
    'dim-constitution': d.constitution,
    'dim-resources':    d.resources,
    'dim-goals':        d.goals,
  }
}



/** Zoom thresholds — camera.z values that trigger level transitions */
export const ZOOM = {
  /** Above this = L2 (only root entities visible) */
  L2_THRESHOLD: 600,
  /** Between L2 and L1 = L1 (tiered sub-structure visible) */
  L1_THRESHOLD: 250,
  /** Below L1 = L0 (actionable items, Focus available) */

  /** Camera limits */
  MAX_Z: 1200,
  MIN_Z: 80,

  /** Animation duration in ms */
  TRANSITION_MS: 800,
}

/** Visual sizing */
export const SIZE = {
  /** Root entity radius at L2 */
  ROOT_RADIUS: 40,
  /** Tier node radius at L1 */
  MID_RADIUS: 18,
  /** Leaf node radius at L0 */
  LEAF_RADIUS: 6,
  /** Minimum visible radius (below this, fade out) */
  MIN_VISIBLE: 2,
}

/** Layout spacing */
export const LAYOUT = {
  /** Distance between root entities */
  ROOT_SPREAD: 200,
  /** Distance between tier children around parent */
  MID_SPREAD: 80,
  /** Distance between leaf children */
  LEAF_SPREAD: 30,
}

/** Background color */
export const BG_COLOR = 0x050508
