import RichText from '../../shared/RichText'
import type { Block, BlockType } from '../../types'

const HEADING_CLS: Record<string, string> = {
  heading1: 'text-3xl font-bold text-neutral-100 mt-6 mb-2',
  heading2: 'text-2xl font-semibold text-neutral-100 mt-5 mb-1.5',
  heading3: 'text-xl font-semibold text-neutral-200 mt-4 mb-1',
  heading4: 'text-lg font-medium text-neutral-200 mt-3 mb-1',
}

export default function HeadingPreview({ block }: { block: Block }) {
  const cls = HEADING_CLS[block.type] ?? HEADING_CLS.heading1
  const Tag = ({ heading1: 'h1', heading2: 'h2', heading3: 'h3', heading4: 'h4' } as Record<BlockType, any>)[block.type] ?? 'h1'
  return (
    <Tag className={cls}>
      <RichText segments={block.content.rich_text} placeholder="标题…" />
    </Tag>
  )
}
