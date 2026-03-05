// 纯只读预览组件，无编辑逻辑，可在任何只读场景单独使用
import type { Block } from './types'
import BlockPreviewInner from './shared/BlockPreviewInner'

interface Props {
  blocks: Block[]
  onNavigate?: (pageId: string) => void
  className?: string
}

export default function RichPreview({ blocks, onNavigate, className }: Props) {
  const blockMap = new Map(blocks.map((b) => [b.id, b]))
  const rootBlocks = blocks.filter((b) => b.parentId === null).sort((a, b) => a.position - b.position)

  return (
    <div className={className}>
      {rootBlocks.map((block) => (
        <div key={block.id} className="py-0.5">
          <BlockPreviewInner
            block={block}
            allBlocks={blockMap}
            onNavigate={onNavigate}
          />
        </div>
      ))}
    </div>
  )
}
