import React, { useState } from 'react'
import { Brain, GitBranch, Lock, History, Plus, Eye, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/lib/translations'

const TheoryView: React.FC = () => {
  const [newPrinciple, setNewPrinciple] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const { t, language } = useTranslation()

  // 模拟生变论条目 - hash链结构（双语）
  const theoryChain = [
    {
      id: 'genesis',
      version: 'Genesis',
      content: language === 'zh' 
        ? '生变论创始原则：自我意识是进化的起点'
        : 'Bornfly Theory Founding Principle: Self-consciousness is the starting point of evolution',
      timestamp: '2024-01-01T00:00:00Z',
      hash: '0000000000000000000000000000000000000000000000000000000000000000',
      prevHash: '0'.repeat(64)
    },
    {
      id: 'v1',
      version: 'v1.0',
      content: language === 'zh' 
        ? '第一版：认知框架 - 感知、思考、行动、反思的循环'
        : 'Version 1.0: Cognitive Framework - The cycle of perception, thinking, action, and reflection',
      timestamp: '2024-01-15T12:30:00Z',
      hash: 'a1b2c3d4e5f678901234567890123456789012345678901234567890123456',
      prevHash: '0000000000000000000000000000000000000000000000000000000000000000'
    },
    {
      id: 'v2',
      version: 'v2.0',
      content: language === 'zh' 
        ? '第二版：价值层次 - 生存、成长、创造、超越'
        : 'Version 2.0: Value Hierarchy - Survival, growth, creation, transcendence',
      timestamp: '2024-02-10T09:15:00Z',
      hash: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
      prevHash: 'a1b2c3d4e5f678901234567890123456789012345678901234567890123456'
    }
  ]

  const handleAddPrinciple = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPrinciple.trim()) return
    // 实际项目中这里会调用hash链添加函数
    console.log('Adding new principle:', newPrinciple)
    setNewPrinciple('')
    setIsAdding(false)
  }

  // 格式化日期
  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.theoryTitle}</h1>
          <p className="text-neutral-400 mt-2">{t.theorySubtitle}</p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-neutral-400">
          <Lock className="w-4 h-4" />
          <span>{t.chainLength}: {theoryChain.length}</span>
        </div>
      </div>

      {/* 添加新原则 */}
      <div className="glass-panel p-6">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-400" />
          <div>
            <h3 className="font-semibold">{t.warning}</h3>
            <p className="text-sm text-neutral-400">{t.warningDesc}</p>
          </div>
        </div>

        <form onSubmit={handleAddPrinciple} className="space-y-4">
          <textarea
            value={newPrinciple}
            onChange={(e) => setNewPrinciple(e.target.value)}
            placeholder={t.inputPlaceholder}
            className="input-field min-h-[120px]"
            disabled={isAdding}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-neutral-400">
              <GitBranch className="w-4 h-4" />
              <span>{t.thisEditWillCreate} v{theoryChain.length}.0</span>
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
                    <span>{t.submitToChain}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 版本历史 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center space-x-2">
            <History className="w-5 h-5" />
            <span>{t.versionHistory}</span>
          </h2>
          <div className="flex items-center space-x-2 text-sm text-neutral-400">
            <Eye className="w-4 h-4" />
            <span>{t.allVersionsDesc}</span>
          </div>
        </div>

        <div className="space-y-4">
          {theoryChain.slice().reverse().map((version, index) => (
            <div key={version.id} className="glass-panel p-6 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-start space-x-4">
                {/* 版本标识 */}
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>

                {/* 内容 */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg font-medium">
                        {version.version}
                      </span>
                      <span className="text-sm text-neutral-400">
                        {formatDate(version.timestamp)}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t.blockNumber} #{theoryChain.length - index}
                    </div>
                  </div>

                  <p className="text-white/90 mb-4 text-lg">{version.content}</p>

                  {/* Hash信息 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs text-neutral-400">
                        <Lock className="w-3 h-3" />
                        <span>{t.currentHash}:</span>
                      </div>
                      <code className="font-mono bg-black/30 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                        {version.hash.substring(0, 32)}...
                      </code>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2 text-xs text-neutral-400">
                        <GitBranch className="w-3 h-3" />
                        <span>{t.previousHash}:</span>
                      </div>
                      <code className="font-mono bg-black/30 px-3 py-2 rounded-lg text-neutral-300 text-sm block break-all">
                        {version.prevHash.substring(0, 32)}...
                      </code>
                    </div>
                  </div>

                  {/* 验证状态 */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center space-x-2 text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-sm">{t.chainVerified}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default TheoryView