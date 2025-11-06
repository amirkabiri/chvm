import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['cjs'],
  shims: true,
  clean: true,
  minify: true,
  noExternal: ['chalk', 'cli-progress', 'commander', 'ora', 'proper-lockfile'],
});
