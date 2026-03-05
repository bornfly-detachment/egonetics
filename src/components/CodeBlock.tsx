// ============================================================
//  CodeBlock.tsx  —  代码块组件（支持 Markdown 预览 + CodeMirror）
// ============================================================
import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'
import { rust } from '@codemirror/lang-rust'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { sass } from '@codemirror/lang-sass'
import { xml } from '@codemirror/lang-xml'
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import 'highlight.js/styles/github-dark.css'
import type { Block } from './types'

// bash/shell 简单高亮（无独立包）
const bashLang = StreamLanguage.define({
  name: 'bash',
  startState: () => ({}),
  token: (stream: any) => {
    if (stream.match(/#.*/)) return 'comment'
    if (stream.match(/\b(if|then|else|elif|fi|for|do|done|while|until|case|esac|function|export|alias|source|echo|printf|read|exit|return|set|unset|cd|pwd|ls|mkdir|rm|cp|mv|touch|cat|grep|sed|awk|curl|wget)\b/))
      return 'keyword'
    if (stream.match(/\$\{?\w+\}?/)) return 'variable'
    if (stream.match(/"[^"]*"|'[^']*'/)) return 'string'
    stream.next()
    return null
  },
})

// 语言名 → CodeMirror 扩展映射
const LANGUAGE_EXTENSIONS: Record<string, any> = {
  // Web
  json: json(),
  javascript: javascript(),
  js:         javascript(),
  typescript: javascript({ typescript: true }),
  ts:         javascript({ typescript: true }),
  jsx:        javascript({ jsx: true }),
  tsx:        javascript({ typescript: true, jsx: true }),
  css:        css(),
  scss:       sass(),
  sass:       sass(),
  html:       html(),
  xml:        xml(),
  // Systems
  cpp:        cpp(),
  'c++':      cpp(),
  c:          cpp(),
  java:       java(),
  go:         go(),
  rust:       rust(),
  // Scripting
  python:     python(),
  py:         python(),
  php:        php(),
  bash:       bashLang,
  shell:      bashLang,
  // Data / Query
  sql:        sql(),
  yaml:       yaml(),
  yml:        yaml(),
  // Docs
  markdown:   markdown({ base: markdownLanguage, codeLanguages: languages }),
  md:         markdown({ base: markdownLanguage, codeLanguages: languages }),
}

interface CodeBlockProps {
  language: string
  value: string
  onChange?: (value: string) => void
  onBlur?: () => void
  readOnly?: boolean
  placeholder?: string
  isEditing?: boolean
  onClickEdit?: () => void
  onUpdateContent?: (patch: Partial<Block['content']>) => void // 新增：更新 block.content
  viewMode?: 'edit' | 'preview' // 新增：接受外部传入的 viewMode
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  value,
  onChange,
  onBlur,
  readOnly = false,
  placeholder = '',
  // isEditing, onClickEdit, onUpdateContent, viewMode: 接口保留供外部传入，组件内暂不使用
}) => {
  const isMarkdown = language === 'markdown' || language === 'md'

  // Markdown 语言：只读（预览）模式显示 ReactMarkdown；编辑模式显示 CodeMirror
  if (isMarkdown && readOnly) {
    // 写死预览状态，不允许切换
    return (
      <div className="w-full">
        {/* 预览模式 */}
        {value ? (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                // 自定义代码块样式
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <div className="my-2 rounded-lg overflow-hidden">
                      <div className="px-3 py-1 bg-neutral-800 border-b border-neutral-700">
                        <span className="text-xs text-neutral-500 font-mono">{match[1]}</span>
                      </div>
                      <pre className="p-4 text-sm overflow-x-auto">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <code
                      className={`${className} bg-neutral-800 px-1.5 py-0.5 rounded text-sm`}
                      {...props}
                    >
                      {children}
                    </code>
                  )
                },
                // 自定义表格样式
                table({ children }: any) {
                  return (
                    <div className="my-4 overflow-x-auto">
                      <table className="border-collapse border border-neutral-700 w-full">{children}</table>
                    </div>
                  )
                },
                thead({ children }: any) {
                  return <thead className="bg-neutral-800">{children}</thead>
                },
                th({ children }: any) {
                  return (
                    <th className="border border-neutral-700 px-3 py-2 text-left font-semibold">
                      {children}
                    </th>
                  )
                },
                td({ children }: any) {
                  return <td className="border border-neutral-700 px-3 py-2">{children}</td>
                },
                // 自定义链接样式
                a({ children, href }: any) {
                  return (
                    <a
                      href={href}
                      className="text-blue-400 hover:text-blue-300 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {children}
                    </a>
                  )
                },
                // 自定义图片样式
                img({ src, alt }: any) {
                  return <img src={src} alt={alt} className="max-w-full rounded-lg my-4" />
                },
                // 自定义任务列表
                input({ type, checked, ...props }: any) {
                  if (type === 'checkbox') {
                    return <input type="checkbox" checked={checked} readOnly className="mr-2" />
                  }
                  return <input type={type} checked={checked} {...props} />
                },
                // 自定义标题样式
                h1({ children }: any) {
                  return <h1 className="text-3xl font-bold text-neutral-100 my-4">{children}</h1>
                },
                h2({ children }: any) {
                  return <h2 className="text-2xl font-semibold text-neutral-200 my-3">{children}</h2>
                },
                h3({ children }: any) {
                  return <h3 className="text-xl font-medium text-neutral-200 my-2">{children}</h3>
                },
                h4({ children }: any) {
                  return <h4 className="text-lg font-medium text-neutral-200 my-2">{children}</h4>
                },
                // 自定义段落样式
                p({ children }: any) {
                  return <p className="text-neutral-300 leading-relaxed my-2">{children}</p>
                },
                // 自定义列表样式
                ul({ children }: any) {
                  return <ul className="list-disc list-outside pl-5 text-neutral-300 my-2">{children}</ul>
                },
                ol({ children }: any) {
                  return <ol className="list-decimal list-outside pl-5 text-neutral-300 my-2">{children}</ol>
                },
                li({ children }: any) {
                  return <li className="my-1">{children}</li>
                },
                // 自定义引用样式
                blockquote({ children }: any) {
                  return (
                    <blockquote className="border-l-4 border-neutral-600 pl-4 py-1 my-4 text-neutral-400 italic">
                      {children}
                    </blockquote>
                  )
                },
              }}
            >
              {value}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-neutral-500 italic py-4">点击编辑 Markdown…</p>
        )}
      </div>
    )
  }

  const lang = language.toLowerCase()

  // 只读 + 编辑模式都用 CodeMirror（统一高亮，readOnly=true 时禁用光标/输入）
  const extensions = [
    LANGUAGE_EXTENSIONS[lang],
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.domEventHandlers({ blur: () => { onBlur?.(); return false } }),
  ].filter(Boolean)

  return (
    <div className="w-full">
      <CodeMirror
        value={value}
        height="auto"
        minHeight="100px"
        theme={oneDark}
        extensions={extensions}
        onChange={(val: string) => onChange?.(val)}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </div>
  )
}

export default CodeBlock
