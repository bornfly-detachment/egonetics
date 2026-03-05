// 开发验证页 — 仅用于验证 rich-editor 新组件渲染是否正确
// 验证完成后可删除此文件
import BlockPreviewInner from './shared/BlockPreviewInner'
import type { Block } from './types'

const TEST_BLOCKS: Block[] = [
  {
    id: 'b1', parentId: null, position: 1, type: 'paragraph',
    content: { rich_text: [{ text: '这是一个段落块，包含 ' }, { text: '加粗', bold: true }, { text: ' 和 ' }, { text: '斜体', italic: true }, { text: ' 文字。' }] },
  },
  {
    id: 'b2', parentId: null, position: 2, type: 'heading1',
    content: { rich_text: [{ text: '一级标题' }] },
  },
  {
    id: 'b3', parentId: null, position: 3, type: 'heading2',
    content: { rich_text: [{ text: '二级标题' }] },
  },
  {
    id: 'b4', parentId: null, position: 4, type: 'code',
    content: { rich_text: [{ text: '{"name":"egonetics","version":"1.0","nested":{"key":"value","arr":[1,2,3]}}' }], language: 'json' },
  },
  {
    id: 'b5', parentId: null, position: 5, type: 'code',
    content: {
      rich_text: [{ text: 'def fibonacci(n):\nif n<=1:\nreturn n\nreturn fibonacci(n-1)+fibonacci(n-2)\nprint(fibonacci(10))' }],
      language: 'python',
    },
  },
  {
    id: 'b6', parentId: null, position: 6, type: 'code',
    content: {
      rich_text: [{ text: '# Markdown 预览测试\n\n**加粗文字** 和 *斜体文字*\n\n## 代码示例\n\n```js\nconst x = 1\n```\n\n- 列表项 1\n- 列表项 2' }],
      language: 'markdown',
    },
  },
  {
    id: 'b7', parentId: null, position: 7, type: 'bullet',
    content: { rich_text: [{ text: '无序列表项' }] },
  },
  {
    id: 'b8', parentId: null, position: 8, type: 'callout_info',
    content: { rich_text: [{ text: '这是一个 Info Callout 块' }], calloutIcon: 'ℹ️' },
  },
  {
    id: 'b9', parentId: null, position: 9, type: 'divider',
    content: { rich_text: [] },
  },
  {
    id: 'b10', parentId: null, position: 10, type: 'todo',
    content: { rich_text: [{ text: '待办事项示例' }] },
  },
]

export default function DevTest() {
  return (
    <div className="min-h-screen bg-neutral-950 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg text-yellow-300 text-sm">
          ⚠️ 开发验证页 — 验证 rich-editor 新组件渲染正确性，验证完成后删除
        </div>

        <h1 className="text-2xl font-bold text-white mb-6">BlockPreviewInner 渲染验证</h1>

        <div className="space-y-2">
          {TEST_BLOCKS.map((block) => (
            <div key={block.id} className="group relative">
              <div className="absolute -left-20 top-1 text-xs text-neutral-600 font-mono w-16 text-right">
                {block.type}
              </div>
              <div className="border border-neutral-800/50 rounded p-3">
                <BlockPreviewInner block={block} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
