import React, { useState } from 'react'
import { format } from 'date-fns'
import { 
  MessageSquare, 
  GitCommit, 
  Shield, 
  Clock, 
  Hash,
  BookOpen,
  Brain,
  Zap,
  Lock
} from 'lucide-react'
import { useChronicleStore } from '@/stores/useChronicleStore'
import { EntryType } from '@/types'

const ChronicleView: React.FC = () => {
  const { entries, addEntry } = useChronicleStore()
  const [newEntry, setNewEntry] = useState('')
  const [selectedType, setSelectedType] = useState<EntryType>('memory')
  const [isAdding, setIsAdding] = useState(false)

  const entryTypes: { id: EntryType; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'memory', label: 'Memory', icon: <BookOpen className="w-4 h-4" />, color: 'bg-blue-500' },
    { id: 'decision', label: 'Decision', icon: <Brain className="w-4 h-4" />, color: 'bg-purple-500' },
    { id: 'evolution', label: 'Evolution', icon: <Zap className="w-4 h-4" />, color: 'bg-yellow-500' },
    { id: 'principle', label: 'Principle', icon: <Shield className="w-4 h-4" />, color: 'bg-red-500' },
    { id: 'task', label: 'Task', icon: <GitCommit className="w-4 h-4" />, color: 'bg-green-500' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEntry.trim()) return

    setIsAdding(true)
    try {
      await addEntry(newEntry, selectedType)
      setNewEntry('')
    } catch (error) {
      console.error('Failed to add entry:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const getTypeIcon = (type: EntryType) => {
    const typeConfig = entryTypes.find(t => t.id === type)
    return typeConfig?.icon || <MessageSquare className="w-4 h-4" />
  }

  const getTypeColor = (type: EntryType) => {
    const typeConfig = entryTypes.find(t => t.id === type)
    return typeConfig?.color || 'bg-gray-500'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Bornfly Chronicle</h1>
          <p className="text-neutral-400 mt-2">
            Tamper-evident record of your evolution. Each entry is cryptographically linked to the previous one.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-neutral-400">
          <Lock className="w-4 h-4" />
          <span>Chain Length: {entries.length}</span>
        </div>
      </div>

      {/* Add Entry Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <textarea
              value={newEntry}
              onChange={(e) => setNewEntry(e.target.value)}
              placeholder="Record a new memory, decision, or evolution..."
              className="input-field min-h-[100px] resize-none"
              disabled={isAdding}
            />
          </div>
          <div className="flex flex-col space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {entryTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all ${
                    selectedType === type.id
                      ? `${type.color} text-white`
                      : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {type.icon}
                  <span className="text-sm">{type.label}</span>
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={isAdding || !newEntry.trim()}
              className="btn-primary flex items-center justify-center space-x-2"
            >
              {isAdding ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <GitCommit className="w-4 h-4" />
                  <span>Commit to Chain</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Entries List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chronicle Entries</h2>
          <div className="flex items-center space-x-4 text-sm text-neutral-400">
            <div className="flex items-center space-x-1">
              <Hash className="w-4 h-4" />
              <span>Each hash depends on previous entry</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {entries.slice().reverse().map((entry, index) => (
            <div
              key={entry.id}
              className="glass-panel p-6 hover:bg-white/10 transition-all duration-300"
            >
              <div className="flex items-start space-x-4">
                {/* Type Indicator */}
                <div className={`w-10 h-10 ${getTypeColor(entry.type)} rounded-lg flex items-center justify-center`}>
                  {getTypeIcon(entry.type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.type === 'memory' ? 'bg-blue-500/20 text-blue-300' :
                        entry.type === 'decision' ? 'bg-purple-500/20 text-purple-300' :
                        entry.type === 'evolution' ? 'bg-yellow-500/20 text-yellow-300' :
                        entry.type === 'principle' ? 'bg-red-500/20 text-red-300' :
                        'bg-green-500/20 text-green-300'
                      }`}>
                        {entry.type.toUpperCase()}
                      </span>
                      <span className="text-sm text-neutral-400">
                        {format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-neutral-500">
                      <Clock className="w-3 h-3" />
                      <span>Block #{entries.length - index}</span>
                    </div>
                  </div>

                  <p className="text-white/90 mb-4">{entry.content}</p>

                  {/* Hash Display */}
                  <div className="flex items-center space-x-2 text-xs">
                    <div className="flex items-center space-x-1 text-neutral-400">
                      <Hash className="w-3 h-3" />
                      <span>Hash:</span>
                    </div>
                    <code className="font-mono bg-black/30 px-2 py-1 rounded text-neutral-300">
                      {entry.hash.substring(0, 24)}...
                    </code>
                    <div className="flex items-center space-x-1 text-neutral-400 ml-4">
                      <Shield className="w-3 h-3" />
                      <span>Prev:</span>
                    </div>
                    <code className="font-mono bg-black/30 px-2 py-1 rounded text-neutral-300">
                      {entry.prev_hash.substring(0, 16)}...
                    </code>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="glass-panel p-12 text-center">
            <GitCommit className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-neutral-300 mb-2">Chronicle is Empty</h3>
            <p className="text-neutral-500">
              Start recording your evolution. Each entry becomes an immutable part of your digital self.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChronicleView