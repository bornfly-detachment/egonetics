import React from 'react'
import type { Block, BlockPermissions } from '../types'
import BlockEditorInner from './BlockEditorInner'
import BlockPreviewInner from './BlockPreviewInner'

export interface BlockCallbacks {
  onUpdate: (updates: Partial<Block>) => void
  onUpdateContent: (patch: Partial<Block['content']>) => void
  onCommit: (text: string) => void
  onStartEdit: () => void
  onExitEdit: () => void
  onAddAfter: () => void
  onDelete: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  onTypeChange?: (type: import('../types').BlockType) => void
  onSlashMenu?: () => void
  onNavigate?: (pageId: string) => void
  onCreateSubpage?: (blockId: string) => Promise<string>
  onTableCommit?: (rows: import('../types').TableCell[][]) => void
  allBlocks?: Map<string, Block>
}

interface Props extends BlockCallbacks {
  block: Block
  isEditing: boolean
  canEdit: boolean
  // 预留：块级权限覆盖（未来按标签/块赋权）
  permissions?: Partial<BlockPermissions>
  // 预留：嵌套块渲染（未来 columns / toggle 子块）
  renderChildren?: (parentId: string) => React.ReactNode
}

export default function BlockWrapper({ block, isEditing, canEdit, ...callbacks }: Props) {
  if (isEditing && canEdit) {
    return (
      <BlockEditorInner
        block={block}
        isEditing={isEditing}
        {...callbacks}
      />
    )
  }

  return (
    <div
      className={canEdit ? 'cursor-text w-full' : 'w-full'}
      onClick={canEdit ? callbacks.onStartEdit : undefined}
    >
      <BlockPreviewInner block={block} {...callbacks} />
    </div>
  )
}
