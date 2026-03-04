/**
 * MemoryView.tsx — 记忆库 + 标注面板
 *
 * 布局：左侧 60% 标注面板（blocks） + 右侧 40% Session 库
 * Block 类型：heading | text | session_ref
 * 拖拽：右侧 Session 卡拖入左侧 → 生成 session_ref 块
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, ChevronDown, ChevronRight,
  Calendar, MessageCircle, Brain, Upload,
  Search, Edit2, Check, X, BookMarked,
} from 'lucide-react'
import BlockEditor from './BlockEditor'
import type { Block, BlockType, RichTextSegment } from './types'

const API = '/api'
const apiFetch = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`${API}${path}`, opts)
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}
const post  = (path: string, body: unknown) => apiFetch(path, { method: 'POST',  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const patch = (path: string, body: unknown) => apiFetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

// ── Types ──────────────────────────────────────────────────

interface Board {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface BoardBlock {
  id: string
  board_id: string
  type: string   // BlockType for editable blocks, 'session_ref' for session refs
  content: {
    rich_text?: RichTextSegment[]  // BlockEditor format (preferred)
    text?: string                  // legacy plain-text (backwards compat)
    session_id?: string
    session_title?: string
    agent_type?: string
    [key: string]: unknown         // allow all Block content fields
  }
  position: number
}

interface Session {
  id: string
  agent_name: string
  agent_type: string
  model: string | null
  started_at: string | null
  ended_at: string | null
  annotation_title: string | null
  token_input: number
  token_output: number
  round_count: number
  chronicle_entry_id: string | null
}

interface Round {
  id: string
  session_id: string
  round_num: number
  user_input: string | null
  step_count: number
  token_input: number
  token_output: number
}

interface Step {
  id: string
  round_id: string
  step_num: number
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response'
  tool_name: string | null
  content: Record<string, unknown> | string
}

// ── Helpers ────────────────────────────────────────────────

const fmtTokens = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n || 0)
const fmtDate   = (ts: string | null) => {
  if (!ts) return '?'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
const fmtTime   = (ts: string | null) => {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
const agentBadge = (type: string) =>
  type === 'openclaw' ? '🦞' : type === 'claude_code' ? '⚡' : '🤖'

function getStepText(step: Step): string {
  if (typeof step.content === 'string') return step.content
  const c = step.content as Record<string, unknown>
  if (step.type === 'thinking')    return String(c.text || '')
  if (step.type === 'response')    return String(c.text || '')
  if (step.type === 'tool_call')   return JSON.stringify(c.arguments || c, null, 2)
  if (step.type === 'tool_result') return String(c.output || '')
  return JSON.stringify(step.content, null, 2)
}

function genId() { return `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// ── Step Row (in session_ref expansion) ───────────────────

const STEP_STYLES = {
  thinking:    { bg: 'bg-purple-900/20 border-purple-500/40', badge: 'bg-purple-900 text-purple-300', label: '思考' },
  tool_call:   { bg: 'bg-amber-900/15 border-amber-500/30',   badge: 'bg-amber-900 text-amber-300',   label: '工具调用' },
  tool_result: { bg: 'bg-slate-800/50 border-slate-600/40',   badge: 'bg-slate-700 text-slate-300',   label: '工具结果' },
  response:    { bg: 'bg-green-900/20 border-green-500/40',   badge: 'bg-green-900 text-green-300',   label: '输出' },
}

function StepRow({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(step.type === 'response')
  const text    = getStepText(step)
  const preview = text.slice(0, 200)
  const isLong  = text.length > 200
  const s = STEP_STYLES[step.type] || STEP_STYLES.response

  return (
    <div className={`rounded border ${s.bg} mb-1`}>
      <div className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer" onClick={() => isLong && setExpanded(e => !e)}>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${s.badge}`}>
          {s.label}{step.tool_name ? ` · ${step.tool_name}` : ''}
        </span>
        {isLong && <span className="ml-auto text-neutral-600">{expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</span>}
      </div>
      <div className="px-2.5 pb-2 text-xs text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed">
        {expanded || !isLong ? text : preview + '…'}
      </div>
    </div>
  )
}

// ── Session Ref Content (readonly, in board) ───────────────

function SessionRefContent({ sessionId }: { sessionId: string }) {
  const [rounds, setRounds] = useState<Round[] | null>(null)
  const [steps,  setSteps]  = useState<Record<string, Step[]>>({})
  const [expanded, setExpanded]  = useState<Record<string, boolean>>({})
  const [loadingRounds, setLoadingRounds] = useState(false)

  useEffect(() => {
    setLoadingRounds(true)
    apiFetch(`/memory/sessions/${sessionId}/rounds`)
      .then(d => setRounds(d.rounds || []))
      .catch(() => setRounds([]))
      .finally(() => setLoadingRounds(false))
  }, [sessionId])

  const toggleRound = async (roundId: string) => {
    const wasExpanded = !!expanded[roundId]
    setExpanded(e => ({ ...e, [roundId]: !wasExpanded }))
    if (!wasExpanded && !steps[roundId]) {
      const d = await apiFetch(`/memory/rounds/${roundId}/steps`)
      setSteps(prev => ({ ...prev, [roundId]: d.steps || [] }))
    }
  }

  if (loadingRounds) return <div className="text-xs text-neutral-500 py-2">加载中…</div>
  if (!rounds?.length) return <div className="text-xs text-neutral-500 py-2">无对话记录</div>

  return (
    <div className="mt-2 space-y-1">
      {rounds.map(r => (
        <div key={r.id} className="border border-neutral-800 rounded">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-white/5"
            onClick={() => toggleRound(r.id)}
          >
            {expanded[r.id] ? <ChevronDown size={12} className="text-neutral-500" /> : <ChevronRight size={12} className="text-neutral-500" />}
            <MessageCircle size={11} className="text-green-400 shrink-0" />
            <span className="text-xs text-neutral-300 flex-1">
              <span className="text-neutral-500 mr-1">#{r.round_num}</span>
              {r.user_input ? r.user_input.slice(0, 80) + (r.user_input.length > 80 ? '…' : '') : <em className="text-neutral-600">空</em>}
            </span>
            <span className="text-[10px] text-neutral-500 shrink-0">{r.step_count} 步</span>
          </div>
          {expanded[r.id] && (
            <div className="px-2.5 pb-2">
              {r.user_input && (
                <div className="bg-blue-900/20 border border-blue-700/30 rounded p-2 mb-1.5 text-xs text-blue-200 whitespace-pre-wrap">
                  {r.user_input}
                </div>
              )}
              {(steps[r.id] || []).map(step => <StepRow key={step.id} step={step} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Session Ref Card ────────────────────────────────────────

function SessionRefCard({ block, onDelete }: {
  block: BoardBlock
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const title = block.content.session_title || (block.content.session_id as string | undefined)?.slice(0, 12) || '?'

  return (
    <div className="group rounded-lg border border-neutral-700/50 bg-neutral-800/30 mb-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-sm">{agentBadge(String(block.content.agent_type ?? ''))}</span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1.5 flex-1 text-left"
        >
          {expanded
            ? <ChevronDown size={12} className="text-neutral-500 shrink-0" />
            : <ChevronRight size={12} className="text-neutral-500 shrink-0" />}
          <span className="text-sm text-neutral-200 truncate">{title}</span>
          <span className="ml-auto text-[10px] text-neutral-500 shrink-0">📎 引用</span>
        </button>
        <button
          onClick={() => onDelete(block.id)}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-all"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {expanded && block.content.session_id && (
        <div className="px-3 pb-3 border-t border-neutral-700/40 mt-1 pt-2">
          <SessionRefContent sessionId={String(block.content.session_id)} />
        </div>
      )}
    </div>
  )
}

// ── Board ↔ Block converters ────────────────────────────────

function boardBlockToBlock(b: BoardBlock): Block {
  let type: BlockType = 'paragraph'
  if (b.type === 'heading') type = 'heading2'        // legacy board heading → heading2
  else if (b.type !== 'text') type = b.type as BlockType  // already a full BlockType

  const rich_text: RichTextSegment[] = Array.isArray(b.content.rich_text)
    ? b.content.rich_text as RichTextSegment[]
    : [{ text: String(b.content.text ?? '') }]

  return {
    id: b.id,
    parentId: null,
    type,
    content: { ...(b.content as object), rich_text } as Block['content'],
    position: b.position,
  }
}

function blockToBoardBlock(b: Block, boardId: string, position: number): BoardBlock {
  return {
    id: b.id,
    board_id: boardId,
    type: b.type,
    content: b.content as unknown as BoardBlock['content'],
    position,
  }
}

// ── Board Panel (left side) ────────────────────────────────

function BoardPanel() {
  const [boards,          setBoards]          = useState<Board[]>([])
  const [activeBoardId,   setActiveBoardId]   = useState<string | null>(null)
  const [editorBlocks,    setEditorBlocks]    = useState<Block[]>([])
  const [sessionRefs,     setSessionRefs]     = useState<BoardBlock[]>([])
  const [loadingBoards,   setLoadingBoards]   = useState(true)
  const [loadingBlocks,   setLoadingBlocks]   = useState(false)
  const [dropTarget,      setDropTarget]      = useState(false)
  const [renamingBoardId, setRenamingBoardId] = useState<string | null>(null)
  const [renameTitle,     setRenameTitle]     = useState('')
  const [showPublish,     setShowPublish]     = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load boards
  useEffect(() => {
    apiFetch('/memory/boards')
      .then(d => {
        const list = d.boards || []
        setBoards(list)
        if (list.length) setActiveBoardId(list[0].id)
        setLoadingBoards(false)
      })
      .catch(() => setLoadingBoards(false))
  }, [])

  // Load blocks when board changes — split into editable vs session_ref
  useEffect(() => {
    if (!activeBoardId) { setEditorBlocks([]); setSessionRefs([]); return }
    setLoadingBlocks(true)
    apiFetch(`/memory/boards/${activeBoardId}`)
      .then(d => {
        const raw: BoardBlock[] = (d.blocks || []).sort((a: BoardBlock, b: BoardBlock) => a.position - b.position)
        setEditorBlocks(raw.filter(b => b.type !== 'session_ref').map(boardBlockToBlock))
        setSessionRefs(raw.filter(b => b.type === 'session_ref'))
      })
      .catch(() => { setEditorBlocks([]); setSessionRefs([]) })
      .finally(() => setLoadingBlocks(false))
  }, [activeBoardId])

  const saveBoardBlocks = useCallback((notes: Block[], refs: BoardBlock[]) => {
    if (!activeBoardId) return
    const combined = [
      ...notes.map((b, i) => blockToBoardBlock(b, activeBoardId, i + 1)),
      ...refs.map((b, i) => ({ ...b, position: notes.length + i + 1 })),
    ]
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      patch(`/memory/boards/${activeBoardId}`, { blocks: combined }).catch(console.error)
    }, 800)
  }, [activeBoardId])

  const createBoard = async () => {
    const title = prompt('面板标题', '标注面板')
    if (!title?.trim()) return
    const data = await post('/memory/boards', { title: title.trim() })
    const newBoard: Board = { id: data.id, title: data.title, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    setBoards(prev => [...prev, newBoard])
    setActiveBoardId(newBoard.id)
  }

  const renameBoard = async (boardId: string) => {
    const t = renameTitle.trim()
    setRenamingBoardId(null)
    if (!t) return
    await patch(`/memory/boards/${boardId}`, { title: t }).catch(console.error)
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, title: t } : b))
  }

  const deleteBoard = async (boardId: string) => {
    if (!window.confirm('删除此面板及所有块？')) return
    await fetch(`${API}/memory/boards/${boardId}`, { method: 'DELETE' }).catch(console.error)
    setBoards(prev => {
      const next = prev.filter(b => b.id !== boardId)
      setActiveBoardId(next.length ? next[0].id : null)
      return next
    })
  }

  const deleteSessionRef = (id: string) => {
    const next = sessionRefs.filter(b => b.id !== id)
    setSessionRefs(next)
    saveBoardBlocks(editorBlocks, next)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDropTarget(true) }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropTarget(false)
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'))
      if (data.type === 'session_ref') {
        const newRef: BoardBlock = {
          id: genId(),
          board_id: activeBoardId!,
          type: 'session_ref',
          content: {
            session_id:    data.session_id,
            session_title: data.session_title,
            agent_type:    data.agent_type,
          },
          position: editorBlocks.length + sessionRefs.length + 1,
        }
        const next = [...sessionRefs, newRef]
        setSessionRefs(next)
        saveBoardBlocks(editorBlocks, next)
      }
    } catch { /* ignore */ }
  }

  if (loadingBoards) return (
    <div className="flex-1 flex items-center justify-center text-neutral-500 text-sm">加载面板…</div>
  )

  const activeBoard = boards.find(b => b.id === activeBoardId)

  return (
    <div className="flex flex-col h-full">
      {/* Board tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/8 overflow-x-auto shrink-0">
        {boards.map(b => (
          <div key={b.id} className="group/tab relative shrink-0">
            {renamingBoardId === b.id ? (
              <input
                autoFocus
                value={renameTitle}
                onChange={e => setRenameTitle(e.target.value)}
                onBlur={() => renameBoard(b.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') renameBoard(b.id)
                  if (e.key === 'Escape') setRenamingBoardId(null)
                }}
                className="px-2 py-0.5 rounded bg-white/10 border border-white/20 text-xs text-white outline-none w-28"
              />
            ) : (
              <button
                onClick={() => setActiveBoardId(b.id)}
                onDoubleClick={() => { setRenameTitle(b.title); setRenamingBoardId(b.id) }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeBoardId === b.id
                    ? 'bg-white/15 text-white'
                    : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/8'
                }`}
              >
                {b.title}
              </button>
            )}
            {activeBoardId === b.id && !renamingBoardId && (
              <button
                onClick={() => deleteBoard(b.id)}
                className="absolute -top-1 -right-1 w-4 h-4 hidden group-hover/tab:flex items-center justify-center rounded-full bg-neutral-800 hover:bg-red-500/30 text-neutral-500 hover:text-red-400 transition-all"
              >
                <X size={9} />
              </button>
            )}
          </div>
        ))}
        <button onClick={createBoard}
          className="shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-colors">
          <Plus size={12} />
        </button>
      </div>

      {/* Blocks area */}
      {!activeBoardId ? (
        <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
          <button onClick={createBoard} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <Plus size={16} /> 创建第一个标注面板
          </button>
        </div>
      ) : (
        <>
          {activeBoard && (
            <div className="px-4 pt-2 pb-0 flex items-center gap-2 shrink-0">
              <span className="text-xs text-neutral-600">双击标签名可重命名 · / 插入任意块</span>
              <div className="flex-1" />
              <button
                onClick={() => setShowPublish(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all"
                title="将此面板发布到 Chronicle"
              >
                <BookMarked size={12} /> 发布到 Chronicle
              </button>
            </div>
          )}

          <div
            className={`flex-1 overflow-auto px-2 pb-8 transition-colors ${dropTarget ? 'bg-blue-900/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={() => setDropTarget(false)}
            onDrop={handleDrop}
          >
            {loadingBlocks ? (
              <div className="text-neutral-500 text-sm py-4 px-2">加载中…</div>
            ) : (
              <>
                {/* BlockEditor handles all heading / text / media / etc. blocks */}
                <BlockEditor
                  key={activeBoardId}
                  pageId={activeBoardId}
                  initialBlocks={editorBlocks.length ? editorBlocks : undefined}
                  onChange={notes => {
                    setEditorBlocks(notes)
                    saveBoardBlocks(notes, sessionRefs)
                  }}
                />

                {/* Session ref cards — always below editor blocks */}
                {sessionRefs.length > 0 && (
                  <div className="px-2 mt-1 pt-2 border-t border-white/5 space-y-2">
                    {sessionRefs.map(block => (
                      <SessionRefCard key={block.id} block={block} onDelete={deleteSessionRef} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {showPublish && activeBoard && (
        <BoardPublishModal
          board={activeBoard}
          onDone={() => {
            setShowPublish(false)
            setBoards(prev => {
              const next = prev.filter(b => b.id !== activeBoardId)
              setActiveBoardId(next.length ? next[0].id : null)
              return next
            })
          }}
          onClose={() => setShowPublish(false)}
        />
      )}
    </div>
  )
}

// ── Publish Board to Chronicle Modal ──────────────────────

function BoardPublishModal({ board, onDone, onClose }: {
  board: Board
  onDone: () => void
  onClose: () => void
}) {
  const [title,   setTitle]   = useState(board.title)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const doPublish = async () => {
    if (!title.trim()) return
    setLoading(true); setError(null)
    try {
      await post(`/memory/boards/${board.id}/send-to-chronicle`, {
        title: title.trim(),
        summary: summary.trim() || null,
      })
      onDone()
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-white/15 rounded-xl shadow-2xl p-6 w-[520px]" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
          <BookMarked size={16} className="text-blue-400" /> 发布标注面板到 Chronicle
        </h3>
        <p className="text-xs text-neutral-500 mb-4">发布后此面板将从 Memory 移除，内容归入 Chronicle</p>

        <div className="mb-3">
          <label className="text-[11px] text-neutral-500 mb-1 block">标题 *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label className="text-[11px] text-neutral-500 mb-1 block">摘要（可选）</label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={3}
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
            placeholder="对此标注面板的简要总结…"
          />
        </div>

        {error && <p className="mb-3 text-sm text-red-400">❌ {error}</p>}

        <div className="flex gap-2">
          <button onClick={doPublish} disabled={loading || !title.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-sm">
            {loading ? '发布中…' : '确认发布'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm">取消</button>
        </div>
      </div>
    </div>
  )
}

// ── Session Library (right side) ──────────────────────────

function SessionItem({ session, onTitleEdit }: {
  session: Session
  onTitleEdit: (id: string, title: string) => void
}) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [draft,        setDraft]        = useState(session.annotation_title ?? '')
  const [expanded,     setExpanded]     = useState(false)
  const [rounds,       setRounds]       = useState<Round[] | null>(null)
  const [loadingRounds, setLoadingRounds] = useState(false)

  const displayTitle = session.annotation_title || session.id.slice(0, 12) + '…'

  const commitTitle = async () => {
    setEditingTitle(false)
    const t = draft.trim()
    if (t && t !== session.annotation_title) {
      await patch(`/memory/sessions/${session.id}/annotate`, { annotation_title: t })
      onTitleEdit(session.id, t)
    }
  }

  const toggleExpand = async () => {
    const opening = !expanded
    setExpanded(opening)
    if (opening && rounds === null) {
      setLoadingRounds(true)
      apiFetch(`/memory/sessions/${session.id}/rounds`)
        .then(d => setRounds(d.rounds || []))
        .catch(() => setRounds([]))
        .finally(() => setLoadingRounds(false))
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type:          'session_ref',
      session_id:    session.id,
      session_title: session.annotation_title || session.id.slice(0, 12),
      agent_type:    session.agent_type,
    }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      <div className="group rounded-lg border border-transparent hover:border-white/10 bg-white/[0.02] hover:bg-white/[0.04] mb-1.5 transition-colors"
        draggable
        onDragStart={handleDragStart}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button onClick={toggleExpand} className="text-neutral-600 hover:text-neutral-400 shrink-0">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <span className="text-base shrink-0">{agentBadge(session.agent_type)}</span>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
                  className="flex-1 text-xs bg-neutral-800 border border-white/20 rounded px-2 py-0.5 text-white outline-none"
                />
                <button onClick={commitTitle} className="text-green-400 hover:text-green-300"><Check size={12} /></button>
                <button onClick={() => setEditingTitle(false)} className="text-neutral-500 hover:text-neutral-300"><X size={12} /></button>
              </div>
            ) : (
              <span
                className="text-sm text-neutral-200 truncate block cursor-text"
                onDoubleClick={() => { setDraft(session.annotation_title ?? ''); setEditingTitle(true) }}
                title="双击编辑标题"
              >
                {displayTitle}
              </span>
            )}
            <div className="flex items-center gap-2 text-[10px] text-neutral-500 mt-0.5">
              <span>{session.round_count} 轮</span>
              {(session.token_input + session.token_output) > 0 && (
                <span>{fmtTokens(session.token_input + session.token_output)} tok</span>
              )}
              <span>{fmtTime(session.started_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { setDraft(session.annotation_title ?? ''); setEditingTitle(true) }}
              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-300 transition-all"
              title="编辑标题"
            >
              <Edit2 size={11} />
            </button>
            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-neutral-600 cursor-grab" title="拖入面板">拖→</span>
          </div>
        </div>

        {expanded && (
          <div className="px-3 pb-3 border-t border-neutral-800/60 pt-2">
            {loadingRounds && <div className="text-xs text-neutral-500">加载轮次…</div>}
            {rounds?.map(r => (
              <div key={r.id} className="mb-1">
                <div className="text-xs text-neutral-400 mb-0.5">
                  <span className="text-neutral-600">#{r.round_num}</span>{' '}
                  {r.user_input?.slice(0, 100) || <em className="text-neutral-600">空</em>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  )
}

function SessionLibrary() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total,    setTotal]    = useState(0)
  const [search,   setSearch]   = useState('')
  const [offset,   setOffset]   = useState(0)
  const [loading,  setLoading]  = useState(false)
  const [showImport, setShowImport] = useState(false)

  const LIMIT = 30

  const loadSessions = useCallback(async (o: number) => {
    setLoading(true)
    try {
      const d = await apiFetch(`/memory/sessions?limit=${LIMIT}&offset=${o}`)
      if (o === 0) setSessions(d.sessions || [])
      else setSessions(prev => [...prev, ...(d.sessions || [])])
      setTotal(d.total || 0)
      setOffset(o)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSessions(0) }, [loadSessions])

  const handleTitleEdit = (id: string, title: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, annotation_title: title } : s))
  }

  const filtered = search
    ? sessions.filter(s =>
        (s.annotation_title ?? s.id).toLowerCase().includes(search.toLowerCase()) ||
        s.agent_type.toLowerCase().includes(search.toLowerCase())
      )
    : sessions

  // Group by date
  const grouped: { date: string; sessions: Session[] }[] = []
  let lastDate = ''
  for (const s of filtered) {
    const d = fmtDate(s.started_at)
    if (d !== lastDate) { grouped.push({ date: d, sessions: [] }); lastDate = d }
    grouped[grouped.length - 1].sessions.push(s)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8 shrink-0">
        <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/8 rounded-lg px-2 py-1">
          <Search size={12} className="text-neutral-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索…"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder-neutral-600" />
        </div>
        <button onClick={() => setShowImport(true)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-colors"
          title="导入 JSONL">
          <Upload size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2">
        {loading && offset === 0 && (
          <div className="text-center py-8 text-neutral-500 text-sm">加载中…</div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-2 py-1.5 mb-1">
              <div className="h-px flex-1 bg-neutral-800" />
              <span className="text-[10px] text-neutral-600 font-medium shrink-0 flex items-center gap-1">
                <Calendar size={9} /> {group.date}
              </span>
              <div className="h-px flex-1 bg-neutral-800" />
            </div>
            {group.sessions.map(s => (
              <SessionItem
                key={s.id}
                session={s}
                onTitleEdit={handleTitleEdit}
              />
            ))}
          </div>
        ))}

        {filtered.length === 0 && !loading && (
          <div className="text-center py-8 text-neutral-600 text-sm">
            {search ? '无匹配结果' : '暂无 Session'}
          </div>
        )}

        {!search && sessions.length < total && (
          <button
            onClick={() => loadSessions(offset + LIMIT)}
            disabled={loading}
            className="w-full py-2 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? '加载中…' : `加载更多 (${sessions.length} / ${total})`}
          </button>
        )}
      </div>

      {showImport && <ImportModal onDone={() => { setShowImport(false); loadSessions(0) }} onClose={() => setShowImport(false)} />}
    </div>
  )
}

// ── Import Modal ───────────────────────────────────────────

function ImportModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [filePath, setFilePath] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const doImport = async () => {
    if (!filePath.trim()) return
    setLoading(true); setResult(null); setError(null)
    try {
      const data = await post('/memory/import', { filePath: filePath.trim() })
      setResult(`✅ 导入成功：${data.rounds_count} 轮 / ${data.steps_count} 步 (${data.format})`)
      setTimeout(onDone, 1500)
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-white/15 rounded-xl shadow-2xl p-6 w-[560px]" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
          <Upload size={16} className="text-blue-400" /> 导入 JSONL 对话记录
        </h3>
        <p className="text-sm text-neutral-400 mb-3">支持 OpenClaw 和 Claude Code 格式：</p>
        <input type="text" value={filePath} onChange={e => setFilePath(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doImport()}
          placeholder="/Users/xxx/path/to/session.jsonl"
          className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono"
          autoFocus />
        {result && <p className="mt-2 text-sm text-green-400">{result}</p>}
        {error  && <p className="mt-2 text-sm text-red-400">❌ {error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={doImport} disabled={loading || !filePath.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium text-sm">
            {loading ? '导入中…' : '导入'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded text-sm">取消</button>
        </div>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────

export default function MemoryView() {
  return (
    <div className="h-full flex flex-col bg-[#0d0d0f]"
      style={{ fontFamily: "'PingFang SC','SF Pro Text',system-ui,sans-serif" }}>

      {/* Header */}
      <div className="shrink-0 px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={20} className="text-blue-400" />
          <h1 className="text-base font-semibold text-white">Memory</h1>
        </div>
        <div className="text-[11px] text-neutral-600">左侧标注面板 · 右侧 Session 库 · 拖 Session 入面板后可发布到 Chronicle</div>
      </div>

      {/* Main split layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Board panel (60%) */}
        <div className="flex-[3] border-r border-white/[0.06] overflow-hidden flex flex-col">
          <BoardPanel />
        </div>

        {/* Right: Session library (40%) */}
        <div className="flex-[2] overflow-hidden flex flex-col">
          <SessionLibrary />
        </div>
      </div>
    </div>
  )
}
