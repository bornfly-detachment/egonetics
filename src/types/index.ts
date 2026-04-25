// Egonetics Core Types

export type EntryType = 'memory' | 'decision' | 'evolution' | 'principle' | 'task'

export interface ChronicleEntry {
  id: string
  timestamp: string
  content: string
  type: EntryType
  prev_hash: string
  hash: string
  signature?: string
  metadata?: Record<string, any>
}

export interface LifeCore {
  id: string
  name: string
  bornflyTheory: string[]
  egoneticsPrinciples: string[]
  chronicle: ChronicleEntry[]
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  agentSessionKey?: string
  createdAt: string
  updatedAt: string
  subtasks?: Task[]
}

export interface Agent {
  id: string
  name: string
  role: string
  status: 'idle' | 'active' | 'paused' | 'terminated'
  capabilities: string[]
  currentTask?: string
  sessionKey?: string
}

export interface UIState {
  sidebarOpen: boolean
  currentView:
    | 'home'
    | 'memory'
    | 'theory'
    | 'chronicle'
    | 'egonetics'
    | 'egonetics-detail'
    | 'tasks'
    | 'project-detail'
    | 'blog'
    | 'agents'
    | 'cybernetics'
    | 'tag-tree'
    | 'queue'
    | 'controller'
    | 'protocol'
    | 'protocol-builder'
    | 'lab'
    | 'mq'
    | 'recycle'
    | 'prvse-world'
    | 'free-code'
    | 'prv-demo'
    | 'font-compare'
    | 'resources'
    | 'resources-codex'
    | 'resources-claude'
    | 'resources-gemini'
    | 'excalidraw'
    | 'prvse-ui'
  currentTaskId: string | null
  theme: 'dark' | 'light' | 'system'
  fontSize: 'sm' | 'md' | 'lg'
  language: 'en' | 'zh'
}

// ============================================
// Projects System (Notion-style)
// ============================================

export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi-select'
  | 'date'
  | 'checkbox'
  | 'url'

export interface PropertyDef {
  id: string
  name: string
  type: PropertyType
  options?: string[] // for select/multi-select
}

export interface Project {
  id: string
  name: string
  icon: string
  // Dynamic properties as key-value pairs
  properties: Record<string, any>
  // Property definitions
  propertyDefs: PropertyDef[]
  // Rich text content (Tiptap JSON)
  content: string
  createdAt: string
  updatedAt: string
}
