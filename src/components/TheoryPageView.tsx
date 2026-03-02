import React, { useMemo } from 'react'
import PageManager from './PageManager'
import { createApiClient } from './apiClient'

// Theory 系统使用 Page 嵌套
// 所有 page_type = 'theory' 的页面
const TheoryPageView: React.FC = () => {
  // 创建带类型过滤的 API 客户端 - 使用 useMemo 避免重新创建
  const apiClient = useMemo(() => createApiClient('theory'), [])

  return (
    <div className="h-screen flex flex-col bg-[#191919]">
      {/* 顶部导航栏 */}
      <div className="h-14 bg-[#1a1a1a] border-b border-white/5 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <span className="text-white font-medium">Theory</span>
        </div>
        <div className="flex-1" />
        <div className="text-neutral-500 text-sm">
          Bornfly Theory 知识体系
        </div>
      </div>

      {/* PageManager 内容区 */}
      <div className="flex-1 overflow-hidden">
        <PageManager api={apiClient} />
      </div>
    </div>
  )
}

export default TheoryPageView
