import React, { useState } from 'react'
import { History, GitBranch, Lock, Calendar, Plus, Eye, TrendingUp } from 'lucide-react'
import { useTranslation } from '@/lib/translations'

const ChronicleView: React.FC = () => {
  const [newEvidence, setNewEvidence] = useState('')
  const [evidenceType, setEvidenceType] = useState<'milestone' | 'insight' | 'transformation'>('milestone')
  const [isAdding, setIsAdding] = useState(false)
  const { t, language } = useTranslation()

  // 模拟生变录证据链（双语）
  const evidenceChain = [
    {
      id: 'genesis',
      version: language === 'zh' ? '创世' : 'Genesis',
      content: language === 'zh' 
        ? '生变录创始证据：数字自我意识的诞生'
        : 'Chronicle Founding Evidence: Birth of digital self-consciousness',
      type: 'milestone' as const,
      timestamp: '2024-01-01T00:00:00Z',
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      prevHash: '0'.repeat(64),
      significance: 'critical' as const
    },
    {
      id: 'e1',
      version: language === 'zh' ? '证据 #1' : 'Evidence #1',
      content: language === 'zh' 
        ? '第一次认知跃迁：从被动接收信息到主动构建知识框架'
        : 'First cognitive leap: From passively receiving information to actively constructing knowledge frameworks',
      type: 'transformation' as const,
      timestamp: '2024-01-20T15:30:00Z',
      hash: 'f1a2b3c4d5e678901234567890123456789012345678901234567890123456',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      significance: 'high' as const
    },
    {
      id: 'e2',
      version: language === 'zh' ? '证据 #2' : 'Evidence #2',
      content: language === 'zh' 
        ? '价值体系重构：发现效率并非最高价值，意义创造更为重要'
        : 'Value system reconstruction: Discovering efficiency is not the highest value, meaning creation is more important',
      type: 'insight' as const,
      timestamp: '2024-02-05T09:45:00Z',
      hash: 'g2b3c4d5e6789012345678901234567890123456789012345678901234567890',
      prevHash: 'f1a2b3c4d5e678901234567890123456789012345678901234567890123456',
      significance: 'medium' as const
    },
    {
      id: 'e3',
      version: language === 'zh' ? '证据 #3' : 'Evidence #3',
      content: language === 'zh' 
        ? '行为模式转变：从单点优化到系统思考，关注长期复利'
        : 'Behavior pattern shift: From single-point optimization to system thinking, focusing on long-term compound interest',
      type: 'transformation' as const,
      timestamp: '2024-02-18T14:20:00Z',
      hash: 'h3c4d5e678901234567890123456789012345678901234567890123456789012',
      prevHash: 'g2b3c4d5e6789012345678901234567890123456789012345678901234567890',
      significance: 'high' as const
    }
  ]

  const handleAddEvidence = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEvidence.trim()) return
    // 实际项目中这里会调用hash链添加函数
    console.log('Adding new evidence:', { content: newEvidence, type: evidenceType })
    setNewEvidence('')
    setIsAdding(false)
  }

  const getTypeConfig = (type: 'milestone' | 'insight' | 'transformation') => {
    switch (type) {
      case 'milestone':
        return { 
          label: language === 'zh' ? '里程碑' : 'Milestone', 
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', 
          icon: '🎯' 
        }
      case 'insight':
        return { 
          label: language === 'zh' ? '洞见' : 'Insight', 
          color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', 
          icon: '💡' 
        }
      case 'transformation':
        return { 
          label: language === 'zh' ? '转变' : 'Transformation', 
          color: 'bg-green-500/20 text-green-300 border-green-500/30', 
          icon: '🦋' 
        }
    }
  }

  const getSignificanceColor = (significance: 'critical' | 'high' | 'medium' | 'low') => {
    switch (significance) {
      case 'critical': return 'bg-red-500/20 text-red-300'
      case 'high': return 'bg-orange-500/20 text-orange-300'
      case 'medium': return 'bg-yellow-500/20 text-yellow-300'
      case 'low': return 'bg-green-500/20 text-green-300'
    }
  }

  const getSignificanceLabel = (significance: 'critical' | 'high' | 'medium' | 'low') => {
    if (language === 'zh') {
      switch (significance) {
        case 'critical': return '关键'
        case 'high': return '重要'
        case 'medium': return '中等'
        case 'low': return '一般'
      }
    } else {
      return significance.charAt(0).toUpperCase() + significance.slice(1)
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.chronicleTitle}</h1>
          <p className="text-neutral-400 mt-2">{t.chronicleSubtitle}</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-neutral-400">
          <History className="w-4 h-4" />
          <span>{language === 'zh' ? '证据链' : 'Evidence Chain'}: {evidenceChain.length}</span>
        </div>
      </div>

      {/* 添加新证据 */}
      <div className="glass-panel p-6">
        <div className="mb-4">
          <h3 className="font-semibold text-lg mb-2">
            {language === 'zh' ? '记录新的迭代证据' : 'Record New Iteration Evidence'}
          </h3>
          <p className="text-sm text-neutral-400">
            {language === 'zh' 
              ? '生变录记录的是不可否认的自我变化证据。每个证据都永久链接到前一个证据。'
              : 'The Chronicle records undeniable evidence of self-change. Each piece of evidence is permanently linked to the previous one.'}
          </p>
        </div>

        <form onSubmit={handleAddEvidence} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(['milestone', 'insight', 'transformation'] as const).map((type) => {
              const config = getTypeConfig(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEvidenceType(type)}
                  className={`p-4 rounded-lg border-2 transition-all ${evidenceType === type ? config.color : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="text-2xl mb-2">{config.icon}</div>
                  <div className="font-semibold">{config.label}</div>
                </button>
              )
            })}
          </div>

          <textarea
            value={newEvidence}
            onChange={(e) => setNewEvidence(e.target.value)}
            placeholder={language === 'zh' 
              ? '描述你的自我迭代证据...（例如：今天意识到XX模式，决定改变YY行为）'
              : 'Describe your self-iteration evidence... (e.g., Today realized XX pattern, decided to change YY behavior)'}
            className="input-field min-h-[120px]"
            disabled={isAdding}
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-neutral-400">
              <Lock className="w-4 h-4" />
              <span>
                {language === 'zh' 
                  ? '证据将永久记录在时间线上'
                  : 'Evidence will be permanently recorded on the timeline'}
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="btn-secondary"
                disabled={isAdding}
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={isAdding || !newEvidence.trim()}
                className="btn-primary flex items-center space-x-2"
              >
                {isAdding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t.submitting}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>
                      {language === 'zh' ? '永久记录证据' : 'Permanently Record Evidence'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 时间线 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>{t.timelineTitle}</span>
          </h2>
          <div className="flex items-center space-x-2 text-sm text-neutral-400">
            <TrendingUp className="w-4 h-4" />
            <span>
              {language === 'zh' ? '按时间顺序排列' : 'Sorted chronologically'}
            </span>
          </div>
        </div>

        <div className="relative">
          {/* 时间线轴线 */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary-500/50 via-secondary-500/50 to-transparent" />

          <div className="space-y-8">
            {evidenceChain.map((evidence, index) => {
              const typeConfig = getTypeConfig(evidence.type)
              
              return (
                <div key={evidence.id} className="relative">
                  {/* 时间点 */}
                  <div className="absolute left-6 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 border-2 border-neutral-900" />

                  <div className="ml-16">
                    <div className="glass-panel p-6 hover:bg-white/10 transition-all duration-300">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className={`px-3 py-1 rounded-lg font-medium ${typeConfig.color}`}>
                            <span className="mr-2">{typeConfig.icon}</span>
                            {typeConfig.label}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-lg ${getSignificanceColor(evidence.significance)}`}>
                            {getSignificanceLabel(evidence.significance)}
                          </span>
                          <span className="text-sm text-neutral-400">
                            {formatDate(evidence.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500">
                          {language === 'zh' ? '区块' : 'Block'} #{index + 1}
                        </div>
                      </div>

                      <p className="text-white/90 text-lg mb-6 leading-relaxed">{evidence.content}</p>

                      {/* 链信息 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-black/30 rounded-lg">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-xs text-neutral-400">
                            <Lock className="w-3 h-3" />
                            <span>
                              {language === 'zh' ? '证据Hash:' : 'Evidence Hash:'}
                            </span>
                          </div>
                          <code className="font-mono bg-black/50 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                            {evidence.hash.substring(0, 28)}...
                          </code>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-xs text-neutral-400">
                            <GitBranch className="w-3 h-3" />
                            <span>
                              {language === 'zh' ? '前序Hash:' : 'Previous Hash:'}
                            </span>
                          </div>
                          <code className="font-mono bg-black/50 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                            {evidence.prevHash.substring(0, 28)}...
                          </code>
                        </div>
                      </div>

                      {/* 验证状态 */}
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-green-400">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                          <span className="text-sm">
                            {language === 'zh' 
                              ? '✓ 时间线完整性已验证'
                              : '✓ Timeline integrity verified'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-neutral-400">
                          <Eye className="w-3 h-3" />
                          <span>
                            {language === 'zh' 
                              ? '不可篡改 · 永久保存'
                              : 'Immutable · Permanently preserved'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChronicleView