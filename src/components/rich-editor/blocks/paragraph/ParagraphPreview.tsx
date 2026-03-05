import RichText from '../../shared/RichText'
import type { Block } from '../../types'

export default function ParagraphPreview({ block }: { block: Block }) {
  return (
    <p className="text-neutral-200 leading-relaxed min-h-[1.5em]">
      <RichText segments={block.content.rich_text} />
    </p>
  )
}
