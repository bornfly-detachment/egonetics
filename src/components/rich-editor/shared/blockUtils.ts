import type { Block, BlockType, RichTextSegment, TableCell } from '../types'

export const getPlainText = (segs: RichTextSegment[]) => segs.map((s) => s.text).join('')

export const makeSegs = (text: string): RichTextSegment[] => [{ text }]

export const generateBlockId = () =>
  `b-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1
  if (before === null) return (after as number) / 2
  if (after === null) return (before as number) + 1
  return (before + (after as number)) / 2
}

export function defaultBlockContent(type: BlockType): Block['content'] {
  if (type === 'table')
    return {
      rich_text: [],
      tableColCount: 3,
      tableHasHeader: true,
      tableRows: [
        [
          { rich_text: makeSegs('列 1') },
          { rich_text: makeSegs('列 2') },
          { rich_text: makeSegs('列 3') },
        ],
        [{ rich_text: [] }, { rich_text: [] }, { rich_text: [] }],
      ] as TableCell[][],
    }
  if (type === 'code') return { rich_text: [], language: 'plaintext' }
  if (type === 'callout_info') return { rich_text: [], calloutIcon: 'ℹ️' }
  if (type === 'callout_warning') return { rich_text: [], calloutIcon: '⚠️' }
  if (type === 'callout_success') return { rich_text: [], calloutIcon: '✅' }
  if (type === 'callout_tip') return { rich_text: [], calloutIcon: '💡' }
  if (type === 'toggle') return { rich_text: [], toggleOpen: false }
  if (type === 'subpage') return { rich_text: [], subpageTitle: '新页面', subpageIcon: '📄' }
  return { rich_text: [] }
}
