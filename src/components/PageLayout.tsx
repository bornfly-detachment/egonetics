import React, { ReactNode } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'

export interface PageLayoutProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
  showBack?: boolean
  onBack?: () => void
  showChainInfo?: boolean
  chainLength?: number
  actions?: ReactNode
  variant?: 'default' | 'blog' | 'editor'
}

const PageLayout: React.FC<PageLayoutProps> = ({
  title,
  subtitle,
  icon,
  children,
  showBack = false,
  onBack,
  showChainInfo = false,
  chainLength = 0,
  actions,
  variant = 'default',
}) => {
  return (
    <div className={`space-y-6 ${variant === 'blog' ? 'max-w-4xl mx-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showBack && onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {icon && (
            <div className={`${variant === 'blog' ? 'text-5xl' : 'text-4xl'} drop-shadow-lg`}>
              {icon}
            </div>
          )}

          <div>
            <h1
              className={`font-bold gradient-text ${variant === 'blog' ? 'text-4xl' : 'text-3xl'}`}
            >
              {title}
            </h1>
            {subtitle && <p className="text-neutral-400 mt-2 max-w-2xl">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {showChainInfo && (
            <div className="flex items-center space-x-2 text-sm text-neutral-400">
              <Lock className="w-4 h-4" />
              <span>链长度: {chainLength}</span>
            </div>
          )}

          {actions}
        </div>
      </div>

      {/* Content */}
      <div className={variant === 'blog' ? 'glass-panel p-8' : ''}>{children}</div>
    </div>
  )
}

export default PageLayout
