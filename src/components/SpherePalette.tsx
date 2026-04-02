/**
 * SpherePalette — "/" 全局快捷键导航面板
 *
 * 触发: 在任意非输入区域按 "/"
 * 关闭: Escape 或点击背景
 *
 * 树状结构与 WorldSpherePanel 完全一致:
 *   宪法 → L0/L1/L2 → 页面条目
 *   资源 → L0/L1/L2 → 页面条目
 *   目标 → L0/L1/L2 → 页面条目
 *
 * 键盘: ↑↓ 导航  Enter 跳转  Escape 关闭
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import {
  SPHERE_PAGES, LAYER_INFO, COMPONENT_ROUTE,
  type SphereLayer, type SpherePage,
} from './prvse-world/sphere-pages'

export default function SpherePalette() {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const navigate  = useNavigate()
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  // ── "/" global hotkey ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) { setOpen(false); return }

      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement as HTMLElement
        const tag = el?.tagName?.toLowerCase()
        const editable = tag === 'input' || tag === 'textarea' || el?.isContentEditable
        if (!editable) {
          e.preventDefault()
          setOpen(true)
          setQuery('')
          setTimeout(() => inputRef.current?.focus(), 30)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // ── Filtered pages ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return SPHERE_PAGES
    return SPHERE_PAGES.map(sphere => ({
      ...sphere,
      pages: sphere.pages.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q) ||
        p.layer.toLowerCase().includes(q) ||
        sphere.name.toLowerCase().includes(q)
      ),
    })).filter(s => s.pages.length > 0)
  }, [query])

  // Flat list for keyboard navigation
  const flatPages = useMemo<SpherePage[]>(
    () => filtered.flatMap(s => s.pages),
    [filtered],
  )

  // Reset active when results change
  useEffect(() => {
    setActiveId(flatPages[0]?.id ?? null)
  }, [query])

  // ── Auto-scroll active item into view ─────────────────────────
  useEffect(() => {
    if (!activeId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-page-id="${activeId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeId])

  // ── Navigate ──────────────────────────────────────────────────
  const jump = useCallback((page: SpherePage) => {
    setOpen(false)
    const route = COMPONENT_ROUTE[page.component]
    if (route) navigate(route)
  }, [navigate])

  // ── Keyboard nav inside input ─────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'Enter') {
      const p = flatPages.find(p => p.id === activeId) ?? flatPages[0]
      if (p) jump(p)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const idx = flatPages.findIndex(p => p.id === activeId)
      if (idx < flatPages.length - 1) setActiveId(flatPages[idx + 1].id)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = flatPages.findIndex(p => p.id === activeId)
      if (idx > 0) setActiveId(flatPages[idx - 1].id)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-start justify-center pt-[9vh]"
      style={{ background: 'rgba(2,4,12,0.82)', backdropFilter: 'blur(12px)' }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        className="w-full max-w-2xl flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxHeight: '78vh',
          background: 'rgba(5,6,12,0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.85)',
        }}
      >
        {/* ── Search bar ────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07] shrink-0">
          <span
            className="shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded border"
            style={{ color: 'rgba(255,255,255,0.35)', borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)' }}
          >
            /
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索宪法 · 资源 · 目标 — 所有页面…"
            className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/20
              outline-none font-mono"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd
            className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border"
            style={{ color: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
          >
            esc
          </kbd>
        </div>

        {/* ── Tree list ─────────────────────────────────────── */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto py-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {filtered.map(sphere => {
            // Group this sphere's pages by layer
            const byLayer = { L0: [] as SpherePage[], L1: [] as SpherePage[], L2: [] as SpherePage[] }
            sphere.pages.forEach(p => byLayer[p.layer].push(p))
            const hasAny = Object.values(byLayer).some(a => a.length > 0)
            if (!hasAny) return null

            return (
              <div key={sphere.id} className="mb-2">
                {/* Sphere header */}
                <div
                  className="flex items-center gap-2.5 px-4 py-2"
                  style={{ borderLeft: `3px solid ${sphere.color}45` }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: sphere.color,
                      boxShadow: `0 0 8px ${sphere.color}`,
                      animation: 'pulse 2s infinite',
                    }}
                  />
                  <span
                    className="text-[13px] font-mono font-semibold"
                    style={{ color: sphere.color }}
                  >
                    {sphere.name}
                  </span>
                  <span className="text-[9px] font-mono text-white/15 ml-auto">
                    {sphere.pages.length} 个页面
                  </span>
                </div>

                {/* Layers */}
                {(['L0', 'L1', 'L2'] as SphereLayer[]).map(layer => {
                  const pages = byLayer[layer]
                  if (pages.length === 0) return null
                  const lm = LAYER_INFO[layer]

                  return (
                    <div key={layer}>
                      {/* Layer label */}
                      <div className="flex items-center gap-2 px-8 py-1">
                        <span
                          className="text-[9px] font-mono font-medium tracking-wider"
                          style={{ color: lm.color }}
                        >
                          {lm.label}
                        </span>
                        <div
                          className="flex-1 h-px"
                          style={{ background: `${lm.color}18` }}
                        />
                      </div>

                      {/* Page rows */}
                      {pages.map(page => {
                        const isActive = page.id === activeId
                        return (
                          <button
                            key={page.id}
                            data-page-id={page.id}
                            onClick={() => jump(page)}
                            onMouseEnter={() => setActiveId(page.id)}
                            className="w-full flex items-center gap-3 px-10 py-2 text-left transition-colors"
                            style={{
                              background: isActive ? 'rgba(255,255,255,0.055)' : undefined,
                            }}
                          >
                            {/* Color dot */}
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: page.color,
                                boxShadow: `0 0 5px ${page.color}60`,
                              }}
                            />

                            {/* Name */}
                            <span className="text-[12px] font-mono text-white/72 truncate" style={{ minWidth: '140px', maxWidth: '180px' }}>
                              {page.name}
                            </span>

                            {/* Desc */}
                            <span className="flex-1 text-[9px] font-mono text-white/22 truncate">
                              {page.desc}
                            </span>

                            {/* Route pill */}
                            <span
                              className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ color: 'rgba(255,255,255,0.20)', background: 'rgba(255,255,255,0.04)' }}
                            >
                              {COMPONENT_ROUTE[page.component] ?? '—'}
                            </span>

                            {/* Arrow when active */}
                            {isActive && (
                              <ArrowRight
                                size={11}
                                className="shrink-0"
                                style={{ color: 'rgba(255,255,255,0.30)' }}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {flatPages.length === 0 && (
            <div className="py-10 text-center text-[11px] font-mono text-white/20">
              无结果
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div
          className="flex items-center gap-4 px-4 py-2 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {[
            { k: '↑↓', d: '导航' },
            { k: '↵',  d: '跳转' },
            { k: 'esc', d: '关闭' },
          ].map(h => (
            <div key={h.k} className="flex items-center gap-1 text-[8px] text-white/20 font-mono">
              <kbd
                className="px-1 py-px rounded border"
                style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
              >
                {h.k}
              </kbd>
              <span>{h.d}</span>
            </div>
          ))}
          <div className="ml-auto text-[8px] text-white/12 font-mono">
            / 键触发 · 三体世界导航
          </div>
        </div>
      </div>
    </div>
  )
}
