/**
 * RecycleBinView — 历史页面归档
 * 路由仍然有效，但从主导航移除，统一在此入口访问
 */
import { useChronicleStore } from '@/stores/useChronicleStore'
import { useTranslation } from '@/lib/translations'
import { Trash2, ExternalLink } from 'lucide-react'

const PAGE_META = [
  { id: 'egonetics', path: '/egonetics', color: '#f87171' },
  { id: 'agents', path: '/agents', color: '#a78bfa' },
  { id: 'cybernetics', path: '/cybernetics', color: '#818cf8' },
  { id: 'controller', path: '/controller', color: '#34d399' },
  { id: 'queue', path: '/queue', color: '#fb923c' },
]

export default function RecycleBinView() {
  const { setUIState } = useChronicleStore()
  const { t } = useTranslation()
  const rb = t.recycleBin

  return (
    <div className="h-full p-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Trash2 size={18} className="text-white/30" />
        <div>
          <h1 className="text-sm font-bold text-white/70">{rb.title}</h1>
          <p className="text-[10px] text-white/30">{rb.subtitle}</p>
        </div>
      </div>

      <div className="space-y-2">
        {PAGE_META.map(p => {
          const page = rb.pages[p.id]
          return (
            <div
              key={p.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: p.color + '60' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-white/60 group-hover:text-white/80 transition-colors">
                  {page?.label ?? p.id}
                </div>
                <div className="text-[10px] text-white/25 mt-0.5">{page?.desc}</div>
              </div>
              <div className="text-[9px] text-white/20 font-mono shrink-0">{p.path}</div>
              <button
                onClick={() => setUIState({ currentView: p.id as any })}
                className="flex items-center gap-1 text-[9px] text-white/25 hover:text-white/60 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              >
                <ExternalLink size={10} />
                {t.common.open}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
