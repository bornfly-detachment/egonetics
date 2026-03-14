import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react'
import { authFetch } from '../lib/http'
import type { Relation, ProcessVersion } from './types'

interface PropertyEntry {
  key: string
  value: string
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

// ── RelationDetailView ────────────────────────────────────────────

const RelationDetailView: React.FC = () => {
  const { relationId } = useParams<{ relationId: string }>()
  const navigate = useNavigate()

  const [relation, setRelation] = useState<Relation | null>(null)
  const [versions, setVersions] = useState<ProcessVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [properties, setProperties] = useState<PropertyEntry[]>([])

  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!relationId) return
    loadRelation()
  }, [relationId])

  const loadRelation = async () => {
    if (!relationId) return
    try {
      const [rel, vers] = await Promise.all([
        authFetch<Relation & { properties?: string }>(`/relations/${relationId}`),
        authFetch<ProcessVersion[]>(`/relations/${relationId}/versions`),
      ])
      setRelation(rel)
      setTitle(rel.title ?? '')
      setDescription(rel.description ?? '')

      // Parse properties JSON → key-value array
      let props: Record<string, unknown> = {}
      try { props = JSON.parse((rel as any).properties || '{}') } catch { /* ignore */ }
      setProperties(
        Object.entries(props).map(([key, value]) => ({ key, value: String(value) }))
      )
      setVersions(vers)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!relationId) return
    setSaving(true)
    try {
      const propsObj: Record<string, string> = {}
      properties.forEach(p => { if (p.key.trim()) propsObj[p.key.trim()] = p.value })

      await authFetch(`/relations/${relationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, description, properties: JSON.stringify(propsObj) }),
      })
      setDirty(false)
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  const addProperty = () => {
    setProperties(prev => [...prev, { key: '', value: '' }])
    setDirty(true)
  }

  const updateProperty = (i: number, field: 'key' | 'value', val: string) => {
    setProperties(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
    setDirty(true)
  }

  const removeProperty = (i: number) => {
    setProperties(prev => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!relation) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-neutral-500">关系不存在</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-neutral-500 hover:text-neutral-200 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <div className="flex-1" />
        {dirty && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving
              ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save className="w-3.5 h-3.5" />
            }
            保存
          </button>
        )}
      </div>

      {/* Source → Target */}
      <div className="glass-panel p-4">
        <p className="text-[9px] uppercase tracking-widest text-neutral-600 mb-3">关系链路</p>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 px-3 py-2 bg-white/5 rounded-lg">
            <p className="text-[9px] text-neutral-600 mb-0.5">{relation.source_type}</p>
            <p className="text-neutral-300 text-xs truncate font-mono">{relation.source_id}</p>
          </div>
          <div className="text-purple-400 font-bold text-lg shrink-0">→</div>
          <div className="flex-1 px-3 py-2 bg-white/5 rounded-lg">
            <p className="text-[9px] text-neutral-600 mb-0.5">{relation.target_type}</p>
            <p className="text-neutral-300 text-xs truncate font-mono">{relation.target_id}</p>
          </div>
        </div>
      </div>

      {/* Core info */}
      <div className="glass-panel p-5 space-y-4">
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">关系标题</label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true) }}
            placeholder="关系标题"
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 mb-1 block">描述</label>
          <textarea
            value={description}
            onChange={e => { setDescription(e.target.value); setDirty(true) }}
            placeholder="描述这个关系的语义..."
            rows={3}
            className="input-field w-full resize-none"
          />
        </div>
      </div>

      {/* Properties */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-neutral-500">扩展属性</p>
          <button
            onClick={addProperty}
            className="flex items-center gap-1 text-xs text-neutral-600 hover:text-primary-400 transition-colors"
          >
            <Plus className="w-3 h-3" /> 添加
          </button>
        </div>

        {properties.length === 0 ? (
          <p className="text-xs text-neutral-700 italic">暂无属性，点击"添加"新增 key-value 对</p>
        ) : (
          <div className="space-y-2">
            {properties.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={p.key}
                  onChange={e => updateProperty(i, 'key', e.target.value)}
                  placeholder="属性名"
                  className="input-field flex-1 text-sm"
                />
                <input
                  value={p.value}
                  onChange={e => updateProperty(i, 'value', e.target.value)}
                  placeholder="值"
                  className="input-field flex-1 text-sm"
                />
                <button
                  onClick={() => removeProperty(i)}
                  className="p-1 rounded text-neutral-700 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Version history */}
      {versions.length > 0 && (
        <div className="glass-panel p-5">
          <p className="text-xs text-neutral-500 mb-3">版本历史 ({versions.length})</p>
          <div className="space-y-2">
            {[...versions].reverse().map(v => (
              <div key={v.id} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="w-6 h-6 rounded-full bg-primary-500/15 border border-primary-500/30 flex items-center justify-center text-xs text-primary-400 shrink-0 mt-0.5">
                  {v.version_num}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-400">{v.explanation || '(无说明)'}</p>
                  <p className="text-[10px] text-neutral-700 mt-0.5">
                    {v.publisher} · {fmtDate(v.publish_time)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-[10px] text-neutral-700 space-y-0.5 pb-8">
        <p>ID: {relation.id}</p>
        <p>创建者: {relation.creator} · {fmtDate(relation.created_at)}</p>
      </div>
    </div>
  )
}

export default RelationDetailView
