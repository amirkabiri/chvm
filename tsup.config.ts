import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  shims: true,
  clean: true,
  minify: false,
  noExternal: ['chalk', 'ora', 'cli-progress']
})