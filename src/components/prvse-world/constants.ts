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

/** 5-stop color spectrum per root sphere — highlight → base → shadow → glow-near → glow-far */
export interface ColorSpectrum {
  highlight: string
  base: string
  shadow: string
  glowNear: string   // inner atmosphere, ~18% opacity
  glowFar: string    // outer corona, ~4% opacity
  text: string       // readable text on dark bg
}

export const ROOT_SPECTRUM: Record<string, ColorSpectrum> = {
  'dim-constitution': {
    highlight: '#ff6b6b',
    base:      '#e63333',
    shadow:    '#8b1a1a',
    glowNear:  'rgba(230,51,51,0.18)',
    glowFar:   'rgba(255,34,68,0.04)',
    text:      '#ff8888',
  },
  'dim-resources': {
    highlight: '#ffe066',
    base:      '#e6c833',
    shadow:    '#8b7200',
    glowNear:  'rgba(230,200,51,0.16)',
    glowFar:   'rgba(255,221,0,0.04)',
    text:      '#ffdd66',
  },
  'dim-goals': {
    highlight: '#7aaeff',
    base:      '#3366e6',
    shadow:    '#0d2a80',
    glowNear:  'rgba(51,102,230,0.18)',
    glowFar:   'rgba(68,136,255,0.05)',
    text:      '#88aaff',
  },
}

/** Background color */
export const BG_COLOR = 0x050508
