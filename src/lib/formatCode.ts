// ============================================================
//  formatCode.ts — 代码格式化工具（Prettier 3 standalone）
//  支持语言：JSON / JS / TS / JSX / TSX / CSS / SCSS / HTML / Markdown / YAML / GraphQL
//  不支持的语言（Python / Java / Go / Rust 等）原样返回
// ============================================================
import * as prettier from 'prettier/standalone'
import * as babelPlugin from 'prettier/plugins/babel'
import * as estreePlugin from 'prettier/plugins/estree'
import * as typescriptPlugin from 'prettier/plugins/typescript'
import * as postcssPlugin from 'prettier/plugins/postcss'
import * as htmlPlugin from 'prettier/plugins/html'
import * as markdownPlugin from 'prettier/plugins/markdown'
import * as yamlPlugin from 'prettier/plugins/yaml'
import * as graphqlPlugin from 'prettier/plugins/graphql'

type PrettierParser =
  | 'json'
  | 'babel'
  | 'typescript'
  | 'css'
  | 'scss'
  | 'html'
  | 'markdown'
  | 'yaml'
  | 'graphql'

const LANG_PARSER: Record<string, PrettierParser> = {
  javascript: 'babel',
  js:         'babel',
  jsx:        'babel',
  typescript: 'typescript',
  ts:         'typescript',
  tsx:        'typescript',
  css:        'css',
  scss:       'scss',
  sass:       'scss',
  html:       'html',
  xml:        'html',
  markdown:   'markdown',
  md:         'markdown',
  yaml:       'yaml',
  yml:        'yaml',
  graphql:    'graphql',
}

const PARSER_PLUGINS: Record<PrettierParser, any[]> = {
  json:       [babelPlugin, estreePlugin],
  babel:      [babelPlugin, estreePlugin],
  typescript: [typescriptPlugin, estreePlugin],
  css:        [postcssPlugin],
  scss:       [postcssPlugin],
  html:       [htmlPlugin],
  markdown:   [markdownPlugin],
  yaml:       [yamlPlugin],
  graphql:    [graphqlPlugin],
}

export async function formatCode(code: string, language: string): Promise<string> {
  const lang = language.toLowerCase()
  if (!code.trim()) return code

  // JSON：直接用内置 parse/stringify，更快更可靠
  if (lang === 'json') {
    try {
      return JSON.stringify(JSON.parse(code), null, 2)
    } catch {
      return code
    }
  }

  const parser = LANG_PARSER[lang]
  if (!parser) return code // 不支持的语言原样返回

  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins: PARSER_PLUGINS[parser],
      semi: true,
      singleQuote: true,
      tabWidth: 2,
      printWidth: 80,
      trailingComma: 'es5',
    })
    // prettier 末尾会加 \n，去掉避免 CodeMirror 显示多余空行
    return formatted.trimEnd()
  } catch {
    return code // 格式化失败时返回原始代码，不报错
  }
}
