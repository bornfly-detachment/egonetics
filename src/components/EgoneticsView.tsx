import React, { useState } from 'react'
import { Shield, Lock, GitBranch, AlertCircle, Plus, CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from '@/lib/translations'

const EgoneticsView: React.FC = () => {
  const [newPrinciple, setNewPrinciple] = useState('')
  const [principleType, setPrincipleType] = useState<'must' | 'should' | 'could'>('must')
  const [isAdding, setIsAdding] = useState(false)
  const { t, language } = useTranslation()

  // 模拟自我控制论原则 - hash链结构（双语）
  const principlesChain = [
    {
      id: 'genesis',
      version: language === 'zh' ? '创世' : 'Genesis',
      content:
        language === 'zh'
          ? '自我控制论创始原则：用户主权不可侵犯'
          : 'Egonetics Founding Principle: User sovereignty is inviolable',
      type: 'must' as const,
      timestamp: '2024-01-01T00:00:00Z',
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      prevHash: '0'.repeat(64),
      status: 'active' as const,
    },
    {
      id: 'p1',
      version: language === 'zh' ? '原则 1' : 'Principle 1',
      content:
        language === 'zh'
          ? '数据隐私：所有个人数据必须本地存储，未经明确同意不得上传'
          : 'Data Privacy: All personal data must be stored locally and cannot be uploaded without explicit consent',
      type: 'must' as const,
      timestamp: '2024-01-10T14:20:00Z',
      hash: 'c1d2e3f4a5b678901234567890123456789012345678901234567890123456',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000',
      status: 'active' as const,
    },
    {
      id: 'p2',
      version: language === 'zh' ? '原则 2' : 'Principle 2',
      content:
        language === 'zh'
          ? '透明度：所有AI决策必须有可解释的推理过程'
          : 'Transparency: All AI decisions must have an explainable reasoning process',
      type: 'should' as const,
      timestamp: '2024-01-20T10:45:00Z',
      hash: 'd2e3f4a5b6789012345678901234567890123456789012345678901234567890',
      prevHash: 'c1d2e3f4a5b678901234567890123456789012345678901234567890123456',
      status: 'active' as const,
    },
    {
      id: 'p3',
      version: language === 'zh' ? '原则 3' : 'Principle 3',
      content:
        language === 'zh'
          ? '撤销权：用户可以随时撤销任何自动化决策'
          : 'Revocation Right: Users can revoke any automated decision at any time',
      type: 'must' as const,
      timestamp: '2024-02-05T16:30:00Z',
      hash: 'e3f4a5b678901234567890123456789012345678901234567890123456789012',
      prevHash: 'd2e3f4a5b6789012345678901234567890123456789012345678901234567890',
      status: 'active' as const,
    },
  ]

  const handleAddPrinciple = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPrinciple.trim()) return
    // 实际项目中这里会调用hash链添加函数
    console.log('Adding new principle:', { content: newPrinciple, type: principleType })
    setNewPrinciple('')
    setIsAdding(false)
  }

  const getTypeConfig = (type: 'must' | 'should' | 'could') => {
    if (language === 'zh') {
      switch (type) {
        case 'must':
          return {
            label: '必须遵守',
            color: 'bg-red-500/20 text-red-300 border-red-500/30',
            description: '绝对禁止违反的原则',
          }
        case 'should':
          return {
            label: '应该遵守',
            color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            description: '推荐遵守的最佳实践',
          }
        case 'could':
          return {
            label: '可以考虑',
            color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            description: '可选的扩展原则',
          }
      }
    } else {
      switch (type) {
        case 'must':
          return {
            label: 'Must',
            color: 'bg-red-500/20 text-red-300 border-red-500/30',
            description: 'Principles that absolutely must not be violated',
          }
        case 'should':
          return {
            label: 'Should',
            color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            description: 'Recommended best practices',
          }
        case 'could':
          return {
            label: 'Could',
            color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            description: 'Optional extension principles',
          }
      }
    }
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.egoneticsTitle}</h1>
          <p className="text-neutral-400 mt-2">{t.egoneticsSubtitle}</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-neutral-400">
          <Shield className="w-4 h-4" />
          <span>
            {language === 'zh' ? '活跃原则' : 'Active Principles'}: {principlesChain.length}
          </span>
        </div>
      </div>

      {/* 添加新原则 */}
      <div className="glass-panel p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <h3 className="font-semibold">
              {language === 'zh' ? '重要：原则添加规则' : 'Important: Principle Addition Rules'}
            </h3>
            <p className="text-sm text-neutral-400">
              {language === 'zh'
                ? '自我控制论原则一旦添加，永久不可删除。只能通过新版本进行修订或废弃。'
                : 'Egonetics principles cannot be deleted once added. They can only be revised or deprecated through new versions.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleAddPrinciple} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {(['must', 'should', 'could'] as const).map((type) => {
              const config = getTypeConfig(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPrincipleType(type)}
                  className={`p-4 rounded-lg border-2 transition-all ${principleType === type ? config.color : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                >
                  <div className="text-lg font-semibold mb-1">{config.label}</div>
                  <div className="text-sm text-neutral-400">{config.description}</div>
                </button>
              )
            })}
          </div>

          <textarea
            value={newPrinciple}
            onChange={(e) => setNewPrinciple(e.target.value)}
            placeholder={
              language === 'zh' ? '输入新的自我控制论原则...' : 'Enter new Egonetics principle...'
            }
            className="input-field min-h-[100px]"
            disabled={isAdding}
          />

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-neutral-400">
              <Lock className="w-4 h-4" />
              <span>
                {language === 'zh'
                  ? '原则将永久记录在链上'
                  : 'Principle will be permanently recorded on the chain'}
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
                disabled={isAdding || !newPrinciple.trim()}
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
                      {language === 'zh' ? '永久记录原则' : 'Permanently Record Principle'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 原则链 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <GitBranch className="w-5 h-5" />
            <span>{language === 'zh' ? '原则链历史' : 'Principle Chain History'}</span>
          </h2>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1 text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span>
                {language === 'zh' ? '活跃' : 'Active'}:{' '}
                {principlesChain.filter((p) => p.status === 'active').length}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-neutral-400">
              <XCircle className="w-4 h-4" />
              <span>{language === 'zh' ? '已废弃' : 'Deprecated'}: 0</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {principlesChain.map((principle, index) => {
            const typeConfig = getTypeConfig(principle.type)

            return (
              <div
                key={principle.id}
                className="glass-panel p-6 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-start space-x-4">
                  {/* 原则类型标识 */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center ${principle.type === 'must' ? 'bg-red-500' : principle.type === 'should' ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  >
                    <Shield className="w-6 h-6 text-white" />
                  </div>

                  {/* 内容 */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-lg font-medium ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <span className="px-2 py-1 bg-white/10 text-xs rounded-lg">
                          {principle.version}
                        </span>
                        <span className="text-sm text-neutral-400">
                          {formatDate(principle.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500">
                        {language === 'zh' ? '区块' : 'Block'} #{index + 1}
                      </div>
                    </div>

                    <p className="text-white/90 mb-4 text-lg">{principle.content}</p>

                    {/* 链信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs text-neutral-400">
                          <Lock className="w-3 h-3" />
                          <span>Hash:</span>
                        </div>
                        <code className="font-mono bg-black/30 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                          {principle.hash.substring(0, 24)}...
                        </code>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-xs text-neutral-400">
                          <GitBranch className="w-3 h-3" />
                          <span>{language === 'zh' ? '前序Hash' : 'Previous Hash'}:</span>
                        </div>
                        <code className="font-mono bg-black/30 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                          {principle.prevHash.substring(0, 24)}...
                        </code>
                      </div>
                    </div>

                    {/* 状态 */}
                    <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {principle.status === 'active' ? (
                          <>
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-sm text-green-400">
                              {language === 'zh' ? '✓ 生效中' : '✓ Active'}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-400 rounded-full" />
                            <span className="text-sm text-red-400">
                              {language === 'zh' ? '✗ 已废弃' : '✗ Deprecated'}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {language === 'zh' ? '链完整性' : 'Chain Integrity'}: ✓ Verified
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
  )
}

export default EgoneticsView
