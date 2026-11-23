import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

const SAMPLES = fileURLToPath(new URL('../public/samples/', import.meta.url))
const TYPES: Record<string, string> = { m4a: 'audio/mp4', ogg: 'audio/ogg' }
/** Sample files read once per worker, shared by its tests. */
const cache = new Map<string, Promise<Buffer>>()

/** Functional projects: no test listens to the piano, so they get a silent stand-in. */
const SILENT_PROJECTS = new Set(['chromium', 'polish'])

/**
 * A 50 ms silent mono WAV. Web Audio's decoder sniffs the content, not the file's extension, so
 * it stands in for every .m4a and .ogg sample: ~230 decodes of a few hundred bytes instead of
 * 43 MB per page. That was the CI shards' bottleneck (GitHub's runners have no GPU, and the
 * same cores render WebGL in software).
 */
function silentWav(): Buffer {
  const rate = 8000
  const frames = rate / 20
  const data = frames * 2
  const wav = Buffer.alloc(44 + data)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + data, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20) // PCM
  wav.writeUInt16LE(1, 22) // mono
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(data, 40)
  return wav
}
const SILENT = silentWav()

/**
 * Every test serves the piano samples from memory instead of the preview server. With several
 * workers each fresh browser downloading them all, the one server process was the shared
 * bottleneck: pages, chunks and songs queued behind samples and unrelated tests timed out under
 * load. The functional projects get a silent stand-in (above); the visual and perf projects, the
 * real files.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const silent = SILENT_PROJECTS.has(testInfo.project.name)
    await page.route('**/samples/**', async (route) => {
      const path = new URL(route.request().url()).pathname.split('/samples/')[1] ?? ''
      const type = TYPES[path.split('.').pop() ?? '']
      if (type === undefined || path.includes('..')) return route.fallback()
      if (silent) return route.fulfill({ body: SILENT, contentType: 'audio/wav' })
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
