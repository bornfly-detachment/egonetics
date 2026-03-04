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
import { StreamLanguage } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { languages } from '@codemirror/language-data'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import 'highlight.js/styles/github-dark.css'

// 语言配置
const LANGUAGE_EXTENSIONS: Record<string, any> = {
  json: json(),
  javascript: javascript(),
  js: javascript(),
  python: python(),
  py: python(),
  markdown: markdown({ base: markdownLanguage, codeLanguages: languages }),
  md: markdown({ base: markdownLanguage, codeLanguages: languages }),
  css: css(),
  html: html(),
  xml: html(),
  // 简单的 shell/bash 语言支持
  bash: StreamLanguage.define({
    name: 'bash',
    startState: () => ({}),
    token: (stream: any) => {
      if (stream.match(/#.*/)) return 'comment'
      if (
        stream.match(
          /\b(if|then|else|elif|fi|for|do|done|while|until|case|esac|function|export|alias|source|echo|printf|read|exit|return|set|unset|cd|pwd|ls|mkdir|rm|cp|mv|touch|cat|grep|sed|awk|curl|wget)\b/
        )
      )
        return 'keyword'
      if (stream.match(/\$\{?\w+\}?/)) return 'variable'
      if (stream.match(/"[^"]*"|'[^']*'/)) return 'string'
      stream.next()
      return null
    },
  }),
  shell: StreamLanguage.define({
    name: 'bash',
    startState: () => ({}),
    token: (stream: any) => {
      if (stream.match(/#.*/)) return 'comment'
      if (
        stream.match(
          /\b(if|then|else|elif|fi|for|do|done|while|until|case|esac|function|export|alias|source|echo|printf|read|exit|return|set|unset|cd|pwd|ls|mkdir|rm|cp|mv|touch|cat|grep|sed|awk|curl|wget)\b/
        )
      )
        return 'keyword'
      if (stream.match(/\$\{?\w+\}?/)) return 'variable'
      if (stream.match(/"[^"]*"|'[^']*'/)) return 'string'
      stream.next()
      return null
    },
  }),
}

interface CodeBlockProps {
  language: string
  value: string
  onChange?: (value: string) => void
  onBlur?: () => void
  readOnly?: boolean
  placeholder?: string
  isEditing?: boolean // 接受父组件的编辑状态
  onClickEdit?: () => void // 新增：点击预览模式时进入编辑模式
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  value,
  onChange,
  onBlur,
  readOnly = false,
  placeholder = '',
  isEditing = false,
  onClickEdit,
}) => {
  const isMarkdown = language === 'markdown' || language === 'md'

  // Markdown 语言：点击编辑，失焦预览
  if (isMarkdown && !readOnly) {
    if (isEditing) {
      return (
        <div className="w-full">
          <CodeMirror
            value={value}
            height="auto"
            minHeight="100px"
            theme={oneDark}
            extensions={[
              markdown({ base: markdownLanguage, codeLanguages: languages }),
              keymap.of([...defaultKeymap, indentWithTab]),
              EditorView.lineWrapping,
            ]}
            onChange={(val: string) => onChange?.(val)}
            onBlur={() => {
              onBlur?.()
            }}
            autoFocus
            placeholder={placeholder}
          />
        </div>
      )
    }

    return (
      <div
        className="w-full cursor-text prose prose-invert prose-sm max-w-none"
        onClick={onClickEdit}
      >
        {value ? (
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
            }}
          >
            {value}
          </ReactMarkdown>
        ) : (
          <p className="text-neutral-500 italic py-4">点击编辑 Markdown…</p>
        )}
      </div>
    )
  }

  // 其他语言：始终显示 CodeMirror
  const lang = language.toLowerCase()
  const extensions = [
    LANGUAGE_EXTENSIONS[lang],
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
  ].filter(Boolean)

  return (
    <div className="w-full">
      <CodeMirror
        value={value}
        height="auto"
        minHeight="100px"
        maxHeight="600px"
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
