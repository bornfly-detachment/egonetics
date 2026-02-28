import React, { useState } from 'react'
import { Calendar, Clock, BookOpen, Plus, Search } from 'lucide-react'
import { useTranslation } from '@/lib/translations'

const MemoryView: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const { t, language } = useTranslation()

  // 模拟记忆数据
  const memoryEntries = [
    {
      id: '1',
      date: '2024-02-25',
      title: language === 'zh' ? '与OpenAI团队讨论AI伦理' : 'Discussed AI ethics with OpenAI team',
      content: language === 'zh' ? '深入讨论了人工智能的道德框架和未来发展方向' : 'In-depth discussion on ethical frameworks and future development directions for artificial intelligence',
      tags: language === 'zh' ? ['会议', 'AI伦理', '工作'] : ['Meeting', 'AI Ethics', 'Work']
    },
    {
      id: '2',
      date: '2024-02-24',
      title: language === 'zh' ? '阅读《人类简史》' : 'Reading "Sapiens: A Brief History of Humankind"',
      content: language === 'zh' ? '思考人类文明与人工智能的融合可能性' : 'Contemplating the integration possibilities between human civilization and artificial intelligence',
      tags: language === 'zh' ? ['阅读', '思考', '学习'] : ['Reading', 'Thinking', 'Learning']
    }
  ]

  // 根据语言获取星期几
  const weekdays = language === 'zh' 
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // 格式化日期显示
  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.memoryTitle}</h1>
          <p className="text-neutral-400 mt-2">{t.memorySubtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="btn-primary flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>{t.addMemory}</span>
          </button>
          <button className="btn-secondary flex items-center space-x-2">
            <Search className="w-4 h-4" />
            <span>{t.searchMemory}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 日历面板 */}
        <div className="lg:col-span-1 glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>{t.memoryCalendar}</span>
            </h2>
            <span className="text-sm text-neutral-400">
              {formatDate(selectedDate)}
            </span>
          </div>
          
          {/* 简化日历 - 实际项目中应使用 react-calendar */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {weekdays.map(day => (
              <div key={day} className="text-center text-sm text-neutral-400 py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <button
                key={day}
                onClick={() => setSelectedDate(new Date(2024, 1, day))}
                className={`p-2 rounded-lg transition-all ${
                  selectedDate.getDate() === day
                    ? 'bg-primary-500 text-white'
                    : 'hover:bg-white/10 text-neutral-300'
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">{t.todayMemory}</span>
              <span className="font-mono text-primary-300">3条</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-400">{t.thisMonthMemory}</span>
              <span className="font-mono text-primary-300">24条</span>
            </div>
          </div>
        </div>

        {/* 记忆列表 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>{t.recentMemory}</span>
            </h2>
            <div className="flex items-center space-x-2 text-sm text-neutral-400">
              <Clock className="w-4 h-4" />
              <span>{t.sortByTime}</span>
            </div>
          </div>

          {memoryEntries.map(entry => (
            <div key={entry.id} className="glass-panel p-6 hover:bg-white/10 transition-all duration-300">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-sm text-neutral-400">{entry.date}</span>
                    <h3 className="text-lg font-semibold">{entry.title}</h3>
                  </div>
                  <p className="text-neutral-300 mb-4">{entry.content}</p>
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map(tag => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-white/10 text-xs rounded-lg text-neutral-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="ml-4 p-2 text-neutral-400 hover:text-primary-400 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {memoryEntries.length === 0 && (
            <div className="glass-panel p-12 text-center">
              <BookOpen className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neutral-300 mb-2">{t.noMemory}</h3>
              <p className="text-neutral-500">{t.selectDateToStart}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MemoryView