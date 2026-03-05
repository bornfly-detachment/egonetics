/**
 * EgoneticsSubjectPage.tsx
 * /egonetics/:subjectId  →  PageManager 布局（只读）
 * 左树：该 subject 下的 constitution 页面树
 * 右内容：只读 BlockEditor（readOnly=true）
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader, AlertCircle } from 'lucide-react'
import PageManager from './PageManager'
import { createEgoneticsApiClient } from './EgoneticsApiClient'

interface Subject {
  id: string
  name: string
  icon: string
  agent: string
  model: string
  model_display: string | null
  description: string | null
  status: 'active' | 'archived'
  created_at: string
}

async function loadSubject(id: string): Promise<Subject | null> {
  try {
    const res = await fetch(`/api/egonetics/subjects/${id}`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export default function EgoneticsSubjectPage() {
  const { subjectId } = useParams<{ subjectId: string }>()
  const navigate = useNavigate()

  const [subject, setSubject] = useState<Subject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!subjectId) { setError('未找到主题 ID'); setLoading(false); return }
    loadSubject(subjectId).then(s => {
      if (!s) setError('主题不存在或已删除')
      else setSubject(s)
      setLoading(false)
    })
  }, [subjectId])

  const apiClient = useMemo(
    () => subjectId ? createEgoneticsApiClient(subjectId, true) : undefined,
    [subjectId]
  )

  if (loading)
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <Loader size={20} className="animate-spin" />
          <span className="text-sm">加载主题…</span>
        </div>
      </div>
    )

  if (error || !subject || !apiClient)
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-white/60 mb-6">{error}</p>
          <button onClick={() => navigate('/egonetics')}
            className="px-4 py-2 bg-white text-black rounded-xl font-medium hover:bg-white/90">
            返回
          </button>
        </div>
      </div>
    )

  return (
    <div className="h-screen flex flex-col bg-[#191919]"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}>
      {/* Header */}
      <div className="shrink-0 h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 gap-3">
        <button onClick={() => navigate('/egonetics')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={16} />
          <span className="text-sm">返回</span>
        </button>
        <div className="w-px h-4 bg-white/10" />
        <span className="text-xl">{subject.icon}</span>
        <span className="text-white font-medium text-sm">{subject.name}</span>
        {subject.agent && (
          <span className="text-xs bg-white/5 text-neutral-400 px-2 py-0.5 rounded ml-1">
            {subject.agent}
          </span>
        )}
        {subject.model && (
          <span className="text-xs bg-white/5 text-neutral-400 px-2 py-0.5 rounded font-mono">
            {subject.model_display || subject.model}
          </span>
        )}
        <div className="flex-1" />
        <span className="text-xs text-neutral-600">只读 · 选中文字可批注</span>
      </div>

      {/* PageManager */}
      <div className="flex-1 overflow-hidden">
        <PageManager
          api={apiClient}
          readOnly={true}
        />
      </div>
    </div>
  )
}
