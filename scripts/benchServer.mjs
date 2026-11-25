// The production preview the benchmark scripts measure, on a port of its own.
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))

/** Builds (unminified for traces, so functions keep their names) and serves; returns the app's URL. */
export async function benchServer({ port = 4180, named = false } = {}) {
  const outDir = `${root}test-results/bench/dist${named ? '-named' : ''}`
  await build({ root, logLevel: 'error', build: { outDir, emptyOutDir: true, minify: !named } })
  const server = await preview({
    root,
    logLevel: 'error',
    build: { outDir },
    preview: { port, strictPort: true },
  })
  return {
    url: `http://localhost:${port}/pianomeister-online/`,
    close: () => server.close(),
  }
}
