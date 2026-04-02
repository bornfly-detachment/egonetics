import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/kernel/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  dts: false,
  clean: true,
  sourcemap: false,
  target: 'node18',
  outExtension: () => ({ js: '.cjs' }),
})
