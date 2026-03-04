import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChronicleEntry, EntryType, Task, Agent, UIState } from '@/types'
import { BornflyChronicle } from '@/lib/chronicle'

interface ChronicleStore {
  // Core state
  chronicle: BornflyChronicle
  entries: ChronicleEntry[]
  tasks: Task[]
  agents: Agent[]
  uiState: UIState

  // Actions
  addEntry: (
    content: string,
    type?: EntryType,
    metadata?: Record<string, any>
  ) => Promise<ChronicleEntry>
  verifyChain: () => { valid: boolean; brokenAt?: number; error?: string }
  getChain: () => ChronicleEntry[]
  getLatestEntry: () => ChronicleEntry
  getEntryCount: () => number

  // Task management
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void

  // Agent management
  addAgent: (agent: Omit<Agent, 'id'>) => Agent
  updateAgent: (id: string, updates: Partial<Agent>) => void

  // UI state
  setUIState: (updates: Partial<UIState>) => void
  toggleSidebar: () => void

  // Initialize
  initialize: () => void
}

export const useChronicleStore = create<ChronicleStore>()(
  persist(
    (set, get) => ({
      chronicle: new BornflyChronicle(),
      entries: [],
      tasks: [],
      agents: [],
      uiState: {
        sidebarOpen: true,
        currentView: 'memory',
        currentTaskId: null,
        theme: 'dark',
        fontSize: 'md',
        language: 'zh',
      },

      initialize: () => {
        const chronicle = new BornflyChronicle()
        const loaded = chronicle.loadFromStorage()

        set({
          chronicle,
          entries: chronicle.getChain(),
          tasks: [],
          agents: [
            {
              id: 'agent-1',
              name: 'Life Core',
              role: 'Orchestrator',
              status: 'active',
              capabilities: ['decision', 'memory', 'coordination'],
              currentTask: undefined,
            },
            {
              id: 'agent-2',
              name: 'Task Executor',
              role: 'Worker',
              status: 'idle',
              capabilities: ['execution', 'monitoring'],
              currentTask: undefined,
            },
          ],
        })

        if (!loaded) {
          // Add initial entries
          chronicle.addEntry('Egonetics system initialized. Life Core activated.', 'evolution')
          chronicle.addEntry(
            'Bornfly Theory principles loaded. Ready for self-evolution.',
            'principle'
          )
        }
      },

      addEntry: async (content, type = 'memory', metadata) => {
        const { chronicle } = get()
        const entry = await chronicle.addEntry(content, type, metadata)

        set((state) => ({
          entries: [...state.entries, entry],
        }))

        return entry
      },

      verifyChain: () => {
        const { chronicle } = get()
        return chronicle.verifyChain()
      },

      getChain: () => {
        const { chronicle } = get()
        return chronicle.getChain()
      },

      getLatestEntry: () => {
        const { chronicle } = get()
        return chronicle.getLatestEntry()
      },

      getEntryCount: () => {
        const { chronicle } = get()
        return chronicle.getEntryCount()
      },

      addTask: (taskData) => {
        const task: Task = {
          ...taskData,
          id: `task-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          tasks: [...state.tasks, task],
        }))

        return task
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
          ),
        }))
      },

      deleteTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }))
      },

      addAgent: (agentData) => {
        const agent: Agent = {
          ...agentData,
          id: `agent-${Date.now()}`,
        }

        set((state) => ({
          agents: [...state.agents, agent],
        }))

        return agent
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)),
        }))
      },

      setUIState: (updates) => {
        set((state) => ({
          uiState: { ...state.uiState, ...updates },
        }))
      },

      toggleSidebar: () => {
        set((state) => ({
          uiState: { ...state.uiState, sidebarOpen: !state.uiState.sidebarOpen },
        }))
      },
    }),
    {
      name: 'egonetics-store',
      partialize: (state) => ({
        entries: state.entries,
        tasks: state.tasks,
        agents: state.agents,
        uiState: state.uiState,
      }),
    }
  )
)
