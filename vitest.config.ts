import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      // .claude/worktrees holds other sessions' checkouts, with their own copies of every spec.
      exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
