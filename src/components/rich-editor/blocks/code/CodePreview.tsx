import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import { formatCode } from '../../../../lib/formatCode'
import type { Block } from '../../types'
import { getPlainText } from '../../shared/blockUtils'

// Markdown 预览
function MarkdownPreview({ value }: { value: string }) {
  if (!value) return <p className="text-neutral-500 italic py-2">空内容</p>
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <div className="my-2 rounded-lg overflow-hidden">
                <div className="px-3 py-1 bg-neutral-800 border-b border-neutral-700">
                  <span className="text-xs text-neutral-500 font-mono">{match[1]}</span>
                </div>
                <pre className="p-4 text-sm overflow-x-auto">
                  <code className={className} {...props}>{children}</code>
                </pre>
              </div>
            ) : (
              <code className={`${className} bg-neutral-800 px-1.5 py-0.5 rounded text-sm`} {...props}>
                {children}
              </code>
            )
          },
          table: ({ children }: any) => (
            <div className="my-4 overflow-x-auto">
              <table className="border-collapse border border-neutral-700 w-full">{children}</table>
            </div>
          ),
          th: ({ children }: any) => (
            <th className="border border-neutral-700 px-3 py-2 text-left font-semibold bg-neutral-800">{children}</th>
          ),
          td: ({ children }: any) => (
            <td className="border border-neutral-700 px-3 py-2">{children}</td>
          ),
          a: ({ children, href }: any) => (
            <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noreferrer">{children}</a>
          ),
          p: ({ children }: any) => <p className="text-neutral-300 leading-relaxed my-2">{children}</p>,
          h1: ({ children }: any) => <h1 className="text-3xl font-bold text-neutral-100 my-4">{children}</h1>,
          h2: ({ children }: any) => <h2 className="text-2xl font-semibold text-neutral-200 my-3">{children}</h2>,
          h3: ({ children }: any) => <h3 className="text-xl font-medium text-neutral-200 my-2">{children}</h3>,
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-neutral-600 pl-4 py-1 my-4 text-neutral-400 italic">{children}</blockquote>
          ),
          ul: ({ children }: any) => <ul className="list-disc list-outside pl-5 text-neutral-300 my-2">{children}</ul>,
          ol: ({ children }: any) => <ol className="list-decimal list-outside pl-5 text-neutral-300 my-2">{children}</ol>,
          li: ({ children }: any) => <li className="my-1">{children}</li>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

// 代码语法高亮预览（hljs + prettier 格式化）
function CodeHighlightPreview({ value, language }: { value: string; language: string }) {
  const [formatted, setFormatted] = useState(value)

  useEffect(() => {
    let cancelled = false
    formatCode(value, language).then((result) => {
      if (!cancelled) setFormatted(result)
    })
    return () => { cancelled = true }
  }, [value, language])

  const lang = language.toLowerCase()
  const highlighted = hljs.getLanguage(lang)
    ? hljs.highlight(formatted, { language: lang }).value
    : hljs.highlightAuto(formatted).value

  return (
    <pre className="rounded-lg bg-[#0d1117] p-4 overflow-x-auto text-sm font-mono leading-relaxed">
      <code
        className={`hljs language-${lang}`}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  )
}

export default function CodePreview({ block }: { block: Block }) {
  const language = block.content.language ?? 'plaintext'
  const value = getPlainText(block.content.rich_text)
  const isMarkdown = language === 'markdown' || language === 'md'

  return isMarkdown
    ? <MarkdownPreview value={value} />
    : <CodeHighlightPreview value={value} language={language} />
}
