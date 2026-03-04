import React from 'react'

interface BlockWrapperProps {
  children: React.ReactNode
  className?: string
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ children, className = '' }) => {
  return <div className={`block-wrapper my-1 py-1 ${className}`}>{children}</div>
}

export default BlockWrapper
