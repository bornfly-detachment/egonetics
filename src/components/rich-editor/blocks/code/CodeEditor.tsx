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

const LANG_EXT: Record<string, any> = {
  json: json(),
  javascript: javascript(), js: javascript(),
  typescript: javascript({ typescript: true }), ts: javascript({ typescript: true }),
  jsx: javascript({ jsx: true }),
  tsx: javascript({ typescript: true, jsx: true }),
  css: css(), scss: sass(), sass: sass(),
  html: html(), xml: xml(),
  cpp: cpp(), 'c++': cpp(), c: cpp(),
  java: java(), go: go(), rust: rust(), php: php(),
  python: python(), py: python(),
  sql: sql(), yaml: yaml(), yml: yaml(),
  bash: bashLang, shell: bashLang,
  markdown: markdown({ base: markdownLanguage, codeLanguages: languages }),
  md:       markdown({ base: markdownLanguage, codeLanguages: languages }),
}

interface Props {
  language: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
}

export default function CodeEditor({ language, value, onChange, onBlur }: Props) {
  const lang = language.toLowerCase()
  const extensions = [
    LANG_EXT[lang],
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
    EditorView.domEventHandlers({ blur: () => { onBlur(); return false } }),
  ].filter(Boolean)

  return (
    <CodeMirror
      value={value}
      height="auto"
      minHeight="100px"
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
    />
  )
}
