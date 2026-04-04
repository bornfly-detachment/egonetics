/**
 * PrvseWorldView — Three-layer 3D human control interface
 *
 * L1 概念层: 宪法/资源/目标 — always centered, large spheres
 * L2 工程层: 控制论组件 — selected root's children
 * L3 执行层: 细粒度交互 — selected component's leaves
 *
 * Camera LOCKED — no orbit, no pan. Layer drill-down only.
 * 高→低 = 收敛  |  ∞→有限  |  失控→可控
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { ChevronRight, ArrowLeft, MessageSquare, Bookmark } from 'lucide-react'
import { useControlTree, type ControlNode } from './useControlTree'
import { solveLayout, getNodePath } from './engine/layout-solver'
import { createScene, type SceneContext } from './engine/scene'
import { buildEntities, setHighlight, type EntityMap } from './engine/entities'
import { raycastNode, toNDC, buildConnectionLines } from './engine/interaction'
import type { PrvseNode, FocusState } from './types'
import FocusPanel from './overlay/FocusPanel'
import KernelOverlay from './overlay/KernelOverlay'
import NodeInteractionPanel from './overlay/NodeInteractionPanel'
import L1Panel from './overlay/L1Panel'
import L3AIInput from './overlay/L3AIInput'
import HumanQueuePanel from './overlay/HumanQueuePanel'
import WorldSpherePanel from './overlay/WorldSpherePanel'
import { useTranslation } from '@/lib/translations'
import { initFigure8, stepBodies, type Body } from './engine/three-body'

type Layer = 'L2' | 'L3'  // L1 is now the 2D panel overlay — no 3D L1 layer

const CAM_Z = {
  L3: 600,       // 世界层全景：看到全部三根节点
  L2_CLUSTER: 300, // 进入某个根节点后聚焦其子集群
  L2_NODE: 140,  // 点击 L2 具体节点时 zoom-in 特写
}
const LERP = 0.18

export default function PrvseWorldView() {
  const { tree, loading, loadTree } = useControlTree()
  const { t, language } = useTranslation()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sceneRef = useRef<SceneContext | null>(null)
  const entitiesRef = useRef<EntityMap | null>(null)
  const nodesRef = useRef<PrvseNode[]>([])
  const camTarget = useRef({ x: 0, y: 0, z: CAM_Z.L3 })
  const hoveredRef = useRef<string | null>(null)

  // Three-body simulation — figure-8 orbit, runs only in L3 world view
  const threeBodiesRef = useRef<Body[]>(initFigure8())
  const layerRef       = useRef<'L2' | 'L3'>('L3')  // shadow of `layer` for tick closure
  const panelRatioRef  = useRef(0)  // shadow of panelRatio for tick closure

  // Root sphere IDs ordered to match figure-8 bodies [0,1,2]
  const ROOT_IDS = ['dim-constitution', 'dim-resources', 'dim-goals'] as const
  // Scene scale: figure-8 spans ±1.5 natural units → map to ±SCENE_R scene units
  const SCENE_R   = 130      // tighter than 180 but visible motion for all 3 bodies
  const TB_DT     = 0.00095  // natural-unit dt per frame ≈ ~110 s visual period

  const [layer, setLayer] = useState<Layer>('L3')  // 从L3世界层出发
  const [selectedRoot, setSelectedRoot] = useState<ControlNode | null>(null)
  const [l1Panel, setL1Panel] = useState<ControlNode | null>(null)   // 2D overlay for L1
  const [spherePanel, setSpherePanel] = useState<ControlNode | null>(null)  // L3 sphere drawer
  const [panelFullscreen, setPanelFullscreen] = useState(false)
  const [showAIInput, setShowAIInput] = useState(false)  // L3AIInput 需用户显式打开
  const [focus, setFocus] = useState<FocusState | null>(null)
  const [interactNode, setInteractNode] = useState<ControlNode | null>(null)
  const [establishedNodes, setEstablishedNodes] = useState<Set<string>>(new Set())
  const [proposedNodes, setProposedNodes] = useState<Set<string>>(new Set())
  const proposedNodesRef = useRef<Set<string>>(new Set())

  // Load tree
  useEffect(() => {
    if (tree.length === 0 && !loading) loadTree()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep layerRef in sync so the tick closure can read current layer
  useEffect(() => { layerRef.current = layer }, [layer])

  // 宪法规则建立 → 节点 emissive 发光
  useEffect(() => {
    const entities = entitiesRef.current
    if (!entities || establishedNodes.size === 0) return
    for (const [id, group] of entities.meshes) {
      const sphere = group.children[0] as THREE.Mesh
      const mat = sphere.material as THREE.MeshStandardMaterial
      if (establishedNodes.has(id)) {
        const node = entities.nodeData.get(id)
        mat.emissiveIntensity = 0.6
        mat.emissive.setStyle(node?.color ?? '#ffffff')
      }
    }
  }, [establishedNodes])

  // 同步 proposedNodes state → ref（供脉冲动画 tick 使用）
  useEffect(() => {
    proposedNodesRef.current = proposedNodes
  }, [proposedNodes])

  // 变更提议节点 → 脉冲光晕动画
  useEffect(() => {
    if (proposedNodes.size === 0) return
    let rafId: number
    const animate = () => {
      const entities = entitiesRef.current
      if (entities) {
        const t = Date.now() / 600
        for (const id of proposedNodesRef.current) {
          const group = entities.meshes.get(id)
          if (!group) continue
          const sphere = group.children[0] as THREE.Mesh
          const mat = sphere.material as THREE.MeshStandardMaterial
          const node = entities.nodeData.get(id)
          mat.emissive.setStyle(node?.color ?? '#f59e0b')
          mat.emissiveIntensity = 0.3 + 0.4 * Math.abs(Math.sin(t))
        }
      }
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(rafId)
      // 清除已 established 节点之外的 proposed 节点光晕
      const entities = entitiesRef.current
      if (!entities) return
      for (const id of proposedNodesRef.current) {
        if (establishedNodes.has(id)) continue
        const group = entities.meshes.get(id)
        if (!group) continue
        const sphere = group.children[0] as THREE.Mesh
        const mat = sphere.material as THREE.MeshStandardMaterial
        mat.emissiveIntensity = 0
      }
    }
  }, [proposedNodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build scene
  useEffect(() => {
    if (tree.length === 0 || !canvasRef.current || !containerRef.current) return

    const nodes = solveLayout(tree)
    nodesRef.current = nodes

    let ctx = sceneRef.current
    if (!ctx) {
      ctx = createScene(canvasRef.current)
      sceneRef.current = ctx
    }

    while (ctx.worldGroup.children.length > 0) {
      ctx.worldGroup.remove(ctx.worldGroup.children[0])
    }

    const entities = buildEntities(nodes, ctx.worldGroup, language as 'zh' | 'en')
    entitiesRef.current = entities
    buildConnectionLines(nodes, ctx.worldGroup)

    const rect = containerRef.current.getBoundingClientRect()
    ctx.resize(rect.width, rect.height)

    ctx.camera.position.set(0, 0, CAM_Z.L3)
    ctx.camera.lookAt(0, 0, 0)
    camTarget.current = { x: 0, y: 0, z: CAM_Z.L3 }  // 世界层全景

    applyVisibility(entities, nodes, 'L3')

    let running = true
    function tick() {
      if (!running || !ctx) return
      requestAnimationFrame(tick)

      const ct = camTarget.current
      ctx.camera.position.x += (ct.x - ctx.camera.position.x) * LERP
      ctx.camera.position.y += (ct.y - ctx.camera.position.y) * LERP
      ctx.camera.position.z += (ct.z - ctx.camera.position.z) * LERP
      ctx.camera.lookAt(ct.x, ct.y, 0)

      // ── Three-body animation (L3 world view only) ──────────
      if (layerRef.current === 'L3' && entitiesRef.current) {
        threeBodiesRef.current = stepBodies(threeBodiesRef.current, TB_DT)
        const bodies = threeBodiesRef.current
        const pr = panelRatioRef.current
        // Scale down spheres as panel grows; shift left to stay in visible area
        const scale = Math.max(0.15, 1 - pr * 0.85)
        const offsetX = -pr * SCENE_R * 0.9
        ROOT_IDS.forEach((id, i) => {
          const group = entitiesRef.current!.meshes.get(id)
          if (group) {
            group.position.x = bodies[i].x * SCENE_R * scale + offsetX
            group.position.y = bodies[i].y * SCENE_R * scale
            group.scale.setScalar(scale)
          }
        })
      }

      ctx.renderer.render(ctx.scene, ctx.camera)
    }
    tick()

    return () => { running = false }
  }, [tree, language]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        sceneRef.current?.resize(entry.contentRect.width, entry.contentRect.height)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // ── Dynamic 3D adjustment when panel is fullscreen ──
  const panelRatio = spherePanel ? (panelFullscreen ? 1 : 380 / (containerRef.current?.clientWidth ?? 1200)) : 0

  // Keep panelRatioRef in sync for tick closure
  useEffect(() => { panelRatioRef.current = panelRatio }, [panelRatio])

  // ── Layer transitions ──────────────────────────────────────

  const drillDown = useCallback((
    targetLayer: Layer,
    root: ControlNode | null,
    focusPos?: { x: number; y: number },
  ) => {
    setLayer(targetLayer)
    setSelectedRoot(root)
    setL1Panel(null)
    setFocus(null)
    if (targetLayer === 'L3') setInteractNode(null)

    const nodes = nodesRef.current
    const entities = entitiesRef.current
    if (!entities) return

    if (targetLayer === 'L3') {
      // 返回世界层：全局视角，居中
      camTarget.current = { x: 0, y: 0, z: CAM_Z.L3 }
    } else if (targetLayer === 'L2') {
      // 聚焦原则：飞向点击的根节点位置，而非停在原点
      camTarget.current = {
        x: focusPos?.x ?? 0,
        y: focusPos?.y ?? 0,
        z: CAM_Z.L2_CLUSTER,
      }
    }

    applyVisibility(entities, nodes, targetLayer, undefined, root?.id ?? null)
  }, [])

  const goBack = useCallback(() => {
    if (spherePanel) { setSpherePanel(null); return }  // 关闭球体面板
    if (l1Panel) { setL1Panel(null); return }          // 关闭 2D L1 面板，回到 L2
    if (focus) { setFocus(null); return }
    if (layer === 'L2') { setInteractNode(null); drillDown('L3', null) }   // 控制→世界
  }, [layer, selectedRoot, focus, l1Panel, spherePanel, drillDown])

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goBack])

  // ── Mouse (hover + click only, NO orbit/pan) ──────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const ctx = sceneRef.current
    const entities = entitiesRef.current
    if (!canvas || !ctx || !entities) return

    ctx.scene.updateMatrixWorld()
    toNDC(e.nativeEvent, canvas, ctx.mouse)
    const hit = raycastNode(ctx.raycaster, ctx.camera, ctx.mouse, entities.rayTargets, entities.nodeData)
    const prevId = hoveredRef.current
    const newId = hit?.id ?? null
    if (newId !== prevId) {
      setHighlight(entities, newId, prevId)
      hoveredRef.current = newId
      canvas.style.cursor = newId ? 'pointer' : 'default'
    }
  }, [])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current
    const ctx = sceneRef.current
    const entities = entitiesRef.current
    if (!canvas || !ctx || !entities) return

    ctx.scene.updateMatrixWorld()
    toNDC(e.nativeEvent, canvas, ctx.mouse)
    const hit = raycastNode(ctx.raycaster, ctx.camera, ctx.mouse, entities.rayTargets, entities.nodeData)
    if (!hit) { setFocus(null); return }

    if (layer === 'L3' && hit.depth === 0) {
      // L3 世界层 → 点击根节点：打开右侧球体面板（不 zoom in）
      const rootData = tree.find(r => r.id === hit.id)
      if (rootData) {
        // 如果点击同一个球，切换关闭
        setSpherePanel(prev => prev?.id === rootData.id ? null : rootData)
      }
    } else if (layer === 'L2' && hit.depth === 1) {
      // L2 控制层 → 点击控制节点：先 zoom-in 聚焦，再打开 L1 面板
      const compData = findControlNode(tree, hit.id)
      const nodePrvse = nodesRef.current.find(n => n.id === hit.id)
      if (compData) {
        // 摄像机飞到点击节点位置特写
        if (nodePrvse) {
          camTarget.current = { x: nodePrvse.x, y: nodePrvse.y, z: CAM_Z.L2_NODE }
        }
        const rootNode = findRootPrvseNode(nodesRef.current, hit.id)
        const actualRoot = rootNode ? tree.find(r => r.id === rootNode.id) ?? selectedRoot : selectedRoot
        if (actualRoot) setSelectedRoot(actualRoot)
        setInteractNode(null)
        setL1Panel(compData)
      }
    }
  }, [layer, tree, drillDown])

  // ── Render ─────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#050508]">
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onContextMenu={e => e.preventDefault()}
      />

      {/* ── HUD: Breadcrumb (top-left) ── */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5">
        {layer !== 'L3' && (
          <button
            onClick={goBack}
            aria-label={t.common.back}
            className="mr-1 flex items-center justify-center w-9 h-9 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
          >
            <ArrowLeft size={14} />
          </button>
        )}
        <CrumbBtn active={layer === 'L3' && !l1Panel} onClick={() => drillDown('L3', null)} label={t.prvse.layers.concept} />
        {layer === 'L2' && !l1Panel && (
          <>
            <ChevronRight size={10} className="text-white/15" />
            <CrumbBtn active label={t.prvse.layers.engineering} />
          </>
        )}
        {l1Panel && (
          <>
            <ChevronRight size={10} className="text-white/15" />
            <CrumbBtn active={false} onClick={() => setL1Panel(null)} label={t.prvse.layers.engineering} />
            <ChevronRight size={10} className="text-white/15" />
            <CrumbBtn active color={l1Panel.color} label={l1Panel.name} />
          </>
        )}
      </div>

      {/* ── HUD: top-right (收件箱 + contradiction) ── */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
        {/* 人工处理收件箱 — 始终可见 */}
        <div className="relative">
          <HumanQueuePanel />
        </div>
        {/* Contradiction hint — L3 only */}
        {layer === 'L3' && !interactNode && (
          <div className="text-right pointer-events-none">
            <div className="text-[10px] text-white/15 font-mono tracking-wider">{t.prvse.hud.contradiction}</div>
            <div className="text-[9px] text-white/[0.08] mt-0.5">{t.prvse.hud.convergence}</div>
          </div>
        )}
      </div>

      {/* ── HUD: Layer label (bottom-left) — hidden when L1 panel open or L3AIInput visible ── */}
      {!l1Panel && !(layer === 'L3' && tree.length > 0) && (
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
          <div className="text-[11px] text-white/20 font-mono">
            {layer === 'L3' && t.prvse.layers.conceptDesc}
            {layer === 'L2' && t.prvse.layers.engineeringDesc}
          </div>
          <div className="text-[10px] text-white/10 mt-0.5">
            {layer === 'L3' ? t.prvse.hud.clickToEnter : t.prvse.hud.escToGoBack}
          </div>
        </div>
      )}

      {/* ── L3 AI Input: 用户点击按钮打开，不自动弹出 ── */}
      {layer === 'L3' && !l1Panel && !spherePanel && tree.length > 0 && (
        showAIInput ? (
          <L3AIInput activeSphereId={null} />
        ) : (
          <button
            onClick={() => setShowAIInput(true)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2
              px-4 py-2 rounded-xl transition-all
              bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] hover:border-white/[0.15]"
          >
            <MessageSquare size={12} className="text-white/30" />
            <span className="text-[10px] font-mono text-white/30">PRVSE World</span>
          </button>
        )
      )}

      {/* ── Fullscreen mode: bookmark icons on left edge ── */}
      {spherePanel && panelFullscreen && !l1Panel && (
        <div className="absolute top-1/2 -translate-y-1/2 left-1 z-50 flex flex-col gap-2">
          {tree.map(root => {
            const isActive = spherePanel?.id === root.id
            return (
              <button
                key={root.id}
                onClick={() => setSpherePanel(prev => prev?.id === root.id ? null : root)}
                className="group relative flex items-center transition-all duration-200"
              >
                {/* Bookmark icon — always visible */}
                <div
                  className="flex items-center justify-center w-8 h-9 rounded-r-md transition-all duration-200
                    group-hover:w-auto group-hover:px-2.5 group-hover:gap-2"
                  style={{
                    background: isActive ? `${root.color}22` : 'rgba(10,10,15,0.88)',
                    border: `1px solid ${isActive ? `${root.color}40` : 'rgba(255,255,255,0.08)'}`,
                    borderLeft: 'none',
                    boxShadow: isActive ? `2px 0 12px ${root.color}20` : '2px 0 6px rgba(0,0,0,0.3)',
                  }}
                >
                  <Bookmark
                    size={15}
                    fill={isActive ? root.color : 'none'}
                    className="shrink-0 transition-colors"
                    style={{ color: isActive ? root.color : `${root.color}80` }}
                  />
                  {/* Label — slides out on hover */}
                  <span
                    className="text-[10px] font-mono font-semibold whitespace-nowrap overflow-hidden transition-all duration-200
                      max-w-0 opacity-0 group-hover:max-w-[80px] group-hover:opacity-100"
                    style={{ color: isActive ? root.color : 'rgba(255,255,255,0.55)' }}
                  >
                    {root.name}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── L3 Sphere Panel: 右侧抽屉，点击三球体展开 L0/L1/L2 树 + AI 上下文 ── */}
      {spherePanel && !l1Panel && (
        <WorldSpherePanel
          node={spherePanel}
          onClose={() => { setSpherePanel(null); setPanelFullscreen(false) }}
          isFullscreen={panelFullscreen}
          onToggleFullscreen={() => setPanelFullscreen(v => !v)}
        />
      )}

      {/* ── L1: 2D granular panel (full-screen overlay) ── */}
      {l1Panel && selectedRoot && (
        <L1Panel
          comp={l1Panel}
          root={selectedRoot}
          onBack={() => setL1Panel(null)}
        />
      )}

      {/* ── AI Native Interaction Panel ── */}
      {interactNode && !l1Panel && (
        <NodeInteractionPanel
          node={interactNode}
          onClose={() => setInteractNode(null)}
          onDrillChild={(child) => {
            const rootChildren = selectedRoot?.children ?? []
            const compData = rootChildren.find(c => c.id === child.id)
            if (compData && layer === 'L2') {
              setInteractNode(null)
              setL1Panel(compData)   // open 2D panel
            }
          }}
          onMutationProposed={(nodeId) => {
            setProposedNodes(prev => new Set([...prev, nodeId]))
          }}
          onRuleEstablished={(nodeId) => {
            setProposedNodes(prev => { const s = new Set(prev); s.delete(nodeId); return s })
            setEstablishedNodes(prev => new Set([...prev, nodeId]))
          }}
        />
      )}

      {/* Focus Panel (for very deep L3 leaf nodes) */}
      {focus && (
        <FocusPanel
          node={focus.node}
          path={getNodePath(nodesRef.current, focus.nodeId)}
          screenX={focus.screenX}
          screenY={focus.screenY}
          onCommit={async () => setFocus(null)}
          onClose={() => setFocus(null)}
        />
      )}

      {/* Global Minimap — hidden when L1 panel is open */}
      {!interactNode && !l1Panel && tree.length > 0 && (
        <Minimap
          nodes={nodesRef.current}
          layer={layer}
          selectedRootId={selectedRoot?.id ?? null}
          establishedIds={establishedNodes}
          proposedIds={proposedNodes}
          onNavigate={(rootId) => {
            const rootData = tree.find(r => r.id === rootId)
            if (rootData) {
              setInteractNode(rootData)
              drillDown('L2', rootData)
            }
          }}
        />
      )}

      {/* Kernel Overlay */}
      <KernelOverlay />

      {/* Empty state — tree loaded but empty */}
      {!loading && tree.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-white/15 text-[11px] font-mono mb-1">{t.prvse.l3ai.emptyState}</div>
            <div className="text-white/8 text-[10px] font-mono">{t.prvse.hud.clickToEnter}</div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#050508] z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border border-white/20 border-t-white/50 rounded-full animate-spin" />
            <div className="text-white/20 text-[11px] font-mono">{t.common.loading}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Breadcrumb button ──────────────────────────────────────────

function CrumbBtn({ active, color, label, onClick }: {
  active: boolean; color?: string; label: string; onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors ${
        active
          ? 'bg-white/[0.07] border border-white/[0.12] text-white/70'
          : 'border border-transparent text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />}
      {label}
    </Tag>
  )
}


// ── Global Minimap ─────────────────────────────────────────────

interface MinimapProps {
  nodes: PrvseNode[]
  layer: Layer
  selectedRootId: string | null
  establishedIds: Set<string>
  proposedIds: Set<string>
  onNavigate: (rootId: string) => void
}

function Minimap({ nodes, layer, selectedRootId, establishedIds, proposedIds, onNavigate }: MinimapProps) {
  const SIZE = 110
  const PAD  = 14

  const l1Nodes = nodes.filter(n => n.depth === 0)
  if (l1Nodes.length === 0) return null

  // Compute bounding box
  const xs = l1Nodes.map(n => n.x)
  const ys = l1Nodes.map(n => n.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1

  const innerSize = SIZE - PAD * 2
  const toSvg = (x: number, y: number) => ({
    cx: PAD + ((x - minX) / spanX) * innerSize,
    cy: PAD + ((y - minY) / spanY) * innerSize,
  })

  const LAYER_LABEL: Record<Layer, string> = { L2: 'L2', L3: 'L3' }

  return (
    <div className="absolute bottom-4 right-4 z-10 select-none" style={{ width: SIZE, height: SIZE + 18 }}>
      <svg
        width={SIZE}
        height={SIZE}
        className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/[0.07] overflow-visible"
      >
        {/* Connection lines between L1 nodes */}
        {l1Nodes.map((n, i) => {
          if (i === 0) return null
          const { cx: x1, cy: y1 } = toSvg(l1Nodes[0].x, l1Nodes[0].y)
          const { cx: x2, cy: y2 } = toSvg(n.x, n.y)
          return <line key={`l-${n.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
        })}

        {l1Nodes.map(n => {
          const { cx, cy } = toSvg(n.x, n.y)
          const isSelected = n.id === selectedRootId
          const isEstablished = establishedIds.has(n.id)
          const isProposed = proposedIds.has(n.id)
          const r = isSelected ? 6 : 4

          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate(n.id)}>
              {/* Proposal aura */}
              {isProposed && !isEstablished && (
                <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#f59e0b" strokeWidth="1" opacity="0.4">
                  <animate attributeName="r" values={`${r + 2};${r + 6};${r + 2}`} dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.4s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Established ring */}
              {isEstablished && (
                <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke={n.color} strokeWidth="1.5" opacity="0.6" />
              )}
              {/* Selected ring */}
              {isSelected && (
                <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              )}
              {/* Node dot */}
              <circle cx={cx} cy={cy} r={r} fill={n.color} opacity={isSelected ? 0.85 : 0.45} />
              {/* Label */}
              <text x={cx} y={cy + r + 7} textAnchor="middle" fontSize="5.5" fill="rgba(255,255,255,0.35)" fontFamily="monospace">
                {n.name.length > 4 ? n.name.slice(0, 4) : n.name}
              </text>
            </g>
          )
        })}
      </svg>
      {/* Layer badge */}
      <div className="flex items-center justify-between mt-1 px-1">
        <span className="text-[8px] font-mono text-white/20">minimap</span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40">
          {LAYER_LABEL[layer]}
        </span>
      </div>
    </div>
  )
}

// ── Visibility per layer ──────────────────────────────────────

function applyVisibility(
  entities: EntityMap,
  _nodes: PrvseNode[],
  layer: Layer,
  establishedNodeIds?: Set<string>,
  selectedRootId?: string | null,
) {
  for (const [id, group] of entities.meshes) {
    const node = entities.nodeData.get(id)!
    const sphere = group.children[0] as THREE.Mesh
    const mat = sphere.material as THREE.MeshStandardMaterial

    let opacity = 0

    if (layer === 'L3') {
      // 世界层：只显示三个根节点（目标/宪法/资源）
      opacity = node.depth === 0 ? 1 : 0
    } else if (layer === 'L2') {
      // 控制层：只展示被点击的 L3 根节点的 depth-1 子节点
      // 宪法→kernel/prvse/protocol/...  资源→intelligence/priority/...  目标→plan/objective/...
      if (node.depth === 0) {
        opacity = 0   // L3 根节点在 L2 视图中完全不可见
      } else if (node.depth === 1) {
        opacity = (selectedRootId && node.parentId === selectedRootId) ? 1 : 0
      } else {
        opacity = 0
      }
    }
    // L1 is handled by 2D panel — no 3D visibility needed

    mat.opacity = opacity
    group.visible = opacity > 0.01
    sphere.visible = group.visible

    // 宪法规则已建立的节点 — emissive 发光
    const isEstablished = establishedNodeIds?.has(id) ?? false
    mat.emissiveIntensity = isEstablished ? 0.6 : 0
    if (isEstablished) {
      mat.emissive.setStyle(node.color ?? '#ffffff')
    }

    for (let i = 1; i < group.children.length; i++) {
      const child = group.children[i]
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.opacity = opacity * 0.3
      }
      if (child instanceof THREE.Sprite && child.material instanceof THREE.SpriteMaterial) {
        child.material.opacity = opacity
      }
    }
  }
}

// ── findControlNode ─────────────────────────────────────────────
// 在全树中找到任意深度的节点（用于 L2 统一层点击）

function findControlNode(roots: ControlNode[], id: string): ControlNode | null {
  for (const root of roots) {
    if (root.id === id) return root
    const found = findControlNode(root.children ?? [], id)
    if (found) return found
  }
  return null
}

// ── findRootPrvseNode ───────────────────────────────────────────
// 从 PrvseNode 列表中向上追溯，找到 depth===0 的根节点

function findRootPrvseNode(nodes: PrvseNode[], nodeId: string): PrvseNode | null {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null
  if (node.depth === 0) return node
  if (node.parentId) return findRootPrvseNode(nodes, node.parentId)
  return null
}
