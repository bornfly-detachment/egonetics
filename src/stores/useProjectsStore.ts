import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Project, PropertyDef, PropertyType } from '@/types'

interface ProjectsStore {
  projects: Project[]
  currentProjectId: string | null
  
  // CRUD
  addProject: (name: string, icon?: string) => Project
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void
  
  // Current project
  setCurrentProject: (id: string | null) => void
  getCurrentProject: () => Project | null
  
  // Properties
  addPropertyDef: (projectId: string, def: Omit<PropertyDef, 'id'>) => void
  updatePropertyDef: (projectId: string, defId: string, updates: Partial<PropertyDef>) => void
  deletePropertyDef: (projectId: string, defId: string) => void
  updatePropertyValue: (projectId: string, propertyName: string, value: any) => void
  
  // Content
  updateContent: (projectId: string, content: string) => void
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      
      addProject: (name, icon = '📝') => {
        const project: Project = {
          id: `project-${Date.now()}`,
          name,
          icon,
          properties: {},
          propertyDefs: [],
          content: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        
        set((state) => ({
          projects: [...state.projects, project]
        }))
        
        return project
      },
      
      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === id
              ? { ...p, ...updates, updatedAt: new Date().toISOString() }
              : p
          )
        }))
      },
      
      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter(p => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
        }))
      },
      
      setCurrentProject: (id) => {
        set({ currentProjectId: id })
      },
      
      getCurrentProject: () => {
        const { projects, currentProjectId } = get()
        return projects.find(p => p.id === currentProjectId) || null
      },
      
      addPropertyDef: (projectId, def) => {
        const newDef: PropertyDef = {
          ...def,
          id: `prop-${Date.now()}`
        }
        
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  propertyDefs: [...p.propertyDefs, newDef],
                  properties: { ...p.properties, [def.name]: getDefaultValue(def.type) },
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      updatePropertyDef: (projectId, defId, updates) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  propertyDefs: p.propertyDefs.map(d =>
                    d.id === defId ? { ...d, ...updates } : d
                  ),
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      deletePropertyDef: (projectId, defId) => {
        set((state) => ({
          projects: state.projects.map(p => {
            const def = p.propertyDefs.find(d => d.id === defId)
            const { [def?.name || '']: _, ...restProperties } = p.properties
            return {
              ...p,
              propertyDefs: p.propertyDefs.filter(d => d.id !== defId),
              properties: restProperties,
              updatedAt: new Date().toISOString()
            }
          })
        }))
      },
      
      updatePropertyValue: (projectId, propertyName, value) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? {
                  ...p,
                  properties: { ...p.properties, [propertyName]: value },
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      updateContent: (projectId, content) => {
        set((state) => ({
          projects: state.projects.map(p =>
            p.id === projectId
              ? { ...p, content, updatedAt: new Date().toISOString() }
              : p
          )
        }))
      }
    }),
    {
      name: 'egonetics-projects'
    }
  )
)

// Helper function to get default value based on type
function getDefaultValue(type: PropertyType): any {
  switch (type) {
    case 'text': return ''
    case 'number': return 0
    case 'select': return ''
    case 'multi-select': return []
    case 'date': return null
    case 'checkbox': return false
    case 'url': return ''
    default: return ''
  }
}
