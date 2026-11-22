import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

const SAMPLES = fileURLToPath(new URL('../public/samples/', import.meta.url))
const TYPES: Record<string, string> = { m4a: 'audio/mp4', ogg: 'audio/ogg' }
/** Sample files read once per worker, shared by its tests. */
const cache = new Map<string, Promise<Buffer>>()

/**
 * Every test serves the piano samples (~230 files, 43 MB) from memory instead of the preview
 * server. With several workers each fresh browser downloading them all, the one server process
 * was the shared bottleneck: pages, chunks and songs queued behind samples and unrelated tests
 * timed out under load.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/samples/**', async (route) => {
      const path = new URL(route.request().url()).pathname.split('/samples/')[1] ?? ''
      const type = TYPES[path.split('.').pop() ?? '']
      if (type === undefined || path.includes('..')) return route.fallback()
      let file = cache.get(path)
      if (file === undefined) {
        file = readFile(SAMPLES + decodeURIComponent(path))
        cache.set(path, file)
      }
      try {
        await route.fulfill({ body: await file, contentType: type })
      } catch {
        await route.fallback()
      }
    })
    await use(page)
  },
})
