import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, type Browser, type Page } from '@playwright/test'

import { SETTINGS_VERSION } from '../src/core/settings/loadSettings'

/**
 * Contact sheets for design review (milestone 9 round 3): the same paused frame under many
 * settings, composited into one labelled grid in the browser (no image library needed).
 */

export type Settings = Record<string, Record<string, unknown>>

export const PEDAL_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/pedal-demo.mid', import.meta.url),
)
export const LONG_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/long-demo.mid', import.meta.url),
)
/** Long yellow, red, green and purple notes, near and far at bar 2 (round-6 fill candidates). */
export const FILLS_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/fills-demo.mid', import.meta.url),
)
/** White-key chords next to black keys with long sustains, from bar 2 (milestone 9.2). */
export const BLACK_NOTES_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/black-notes-demo.mid', import.meta.url),
)
/** Neighbouring-lane chords from bar 1: stacked labels. */
export const CLARITY_DEMO = fileURLToPath(
  new URL('../test-fixtures/midi/clarity-demo.mid', import.meta.url),
)

/** A frame region in CSS pixels; the whole canvas when omitted. */
export interface Crop {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface Cell {
  readonly label: string
  readonly png: Buffer
}

/** Uploads a song and opens it once, so later reloads open it again. */
export async function openSong(page: Page, file: string, title: string): Promise<void> {
  await page.goto('./#/library')
  await page.getByTestId('upload-input').setInputFiles(file)
  await expect(page.getByTestId('upload-summary')).toHaveText('1 added')
  await page.getByTestId('song-row').filter({ hasText: title }).click()
  await page.getByTestId('details-play').click()
  await expect(page.getByTestId('hud-title')).toHaveText(title)
}

async function frames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let i = 0
        const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    count,
  )
}

/**
 * One frame with `settings` stored (merged over the defaults), the animation clock pinned
 * (`?animTime=3`, or `animTime`) and the song stepped to the start of `bar`; canvas only.
 */
export async function frameWith(
  page: Page,
  settings: Settings,
  bar: number,
  crop?: Crop,
  animTime = 3,
): Promise<Buffer> {
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings }),
  )
  await page.goto(`./#/?animTime=${animTime}`)
  await page.reload()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  for (let i = 1; i < bar; i++) await page.getByRole('button', { name: 'Next bar' }).click()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText(`${bar}:1`)
  await page.mouse.move(2, 300)
  await frames(page, 40)
  const hide = await page.addStyleTag({
    content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }',
  })
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  const clip =
    crop === undefined || box === null
      ? undefined
      : { x: box.x + crop.x, y: box.y + crop.y, width: crop.width, height: crop.height }
  const png = clip === undefined ? await canvas.screenshot() : await page.screenshot({ clip })
  await hide.evaluate((el) => el.remove())
  return png
}

/** Particle counts over a capture (the busiest moment), against the pool's budget. */
export interface ParticleLoad {
  readonly capacity: number
  readonly maxLive: number
  /** Live particles cut short because the budget was full. */
  readonly evicted: number
}

interface CaptureApi {
  start(seed?: number): void
  tickAt(bar: number, seconds: number): number
  step(tick: number, dt: number): void
  particles():
    | { particles: { live: number; capacity: number; evicted: number }; smoke: { live: number } }
    | undefined
  loop(range: { startBar: number; endBar: number } | null, preRollBeats?: number): void
}

/** A loop to set before a capture (milestone 9.2 loop sheets). */
export interface CaptureLoop {
  readonly startBar: number
  readonly endBar: number
  readonly preRollBeats?: number
}

/**
 * Frames of the song playing from the start of `bar`, on a fixed 1/60 s step (`?capture=1`:
 * seeded particles, a synthetic clock), taken `moments` seconds in; plus the particle load
 * over the whole run. Repeatable run to run, unlike real playback.
 */
export async function captureWith(
  page: Page,
  settings: Settings,
  bar: number,
  moments: readonly number[],
  crop?: Crop,
  /** Extra query parameters (review seams). */
  query = '',
  loop: CaptureLoop | null = null,
): Promise<{ readonly pngs: readonly Buffer[]; readonly load: ParticleLoad }> {
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings }),
  )
  await page.goto(`./#/?capture=1${query}`)
  await page.reload()
  await expect(page.getByTestId('hud-bar-beat')).toHaveText('1:1')
  await page.mouse.move(2, 300)
  await frames(page, 20)
  const hide = await page.addStyleTag({
    content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }',
  })
  await page.evaluate(() =>
    (window as unknown as { pianomeisterCapture: CaptureApi }).pianomeisterCapture.start(1),
  )
  if (loop !== null) {
    await page.evaluate(
      (l) =>
        (window as unknown as { pianomeisterCapture: CaptureApi }).pianomeisterCapture.loop(
          { startBar: l.startBar, endBar: l.endBar },
          l.preRollBeats ?? 0,
        ),
      loop,
    )
  }
  const pngs: Buffer[] = []
  // Start a little before the bar, so its first onsets are crossed while playing.
  let elapsed = -0.1
  let maxLive = 0
  for (const moment of moments) {
    const result = await page.evaluate(
      ({ bar, from, to }) => {
        const api = (window as unknown as { pianomeisterCapture: CaptureApi }).pianomeisterCapture
        const dt = 1 / 60
        let t = from
        let most = 0
        while (t < to - 1e-6) {
          t += dt
          api.step(api.tickAt(bar, t), dt)
          const p = api.particles()
          if (p !== undefined) most = Math.max(most, p.particles.live)
        }
        return { t, most }
      },
      { bar, from: elapsed, to: moment },
    )
    elapsed = result.t
    maxLive = Math.max(maxLive, result.most)
    const canvas = page.locator('canvas').first()
    const box = await canvas.boundingBox()
    const clip =
      crop === undefined || box === null
        ? undefined
        : { x: box.x + crop.x, y: box.y + crop.y, width: crop.width, height: crop.height }
    pngs.push(clip === undefined ? await canvas.screenshot() : await page.screenshot({ clip }))
  }
  const stats = await page.evaluate(() =>
    (window as unknown as { pianomeisterCapture: CaptureApi }).pianomeisterCapture.particles(),
  )
  await hide.evaluate((el) => el.remove())
  return {
    pngs,
    load: {
      capacity: stats?.particles.capacity ?? 0,
      maxLive,
      evicted: stats?.particles.evicted ?? 0,
    },
  }
}

/**
 * Composites cells into a grid (`columns` wide, each scaled to `cellWidth`) with a label
 * under each and an optional title, and writes it to `path`.
 */
export async function writeSheet(
  browser: Browser,
  path: string,
  title: string,
  cells: readonly Cell[],
  columns: number,
  cellWidth: number,
): Promise<void> {
  const page = await browser.newPage()
  const dataUrl = await page.evaluate(
    async ({ title, cells, columns, cellWidth }) => {
      const images = await Promise.all(
        cells.map(async (c) => {
          const image = new Image()
          image.src = `data:image/png;base64,${c.png}`
          await image.decode()
          return image
        }),
      )
      const first = images[0]
      const cellHeight =
        first === undefined ? 1 : Math.round((first.height / first.width) * cellWidth)
      const gap = 8
      const labelHeight = 22
      const titleHeight = 36
      const rows = Math.ceil(cells.length / columns)
      const canvas = document.createElement('canvas')
      canvas.width = columns * (cellWidth + gap) + gap
      canvas.height = titleHeight + rows * (cellHeight + labelHeight + gap) + gap
      const g = canvas.getContext('2d') as CanvasRenderingContext2D
      g.fillStyle = '#111317'
      g.fillRect(0, 0, canvas.width, canvas.height)
      g.fillStyle = '#E8ECF4'
      g.font = '600 18px sans-serif'
      g.fillText(title, gap, 24)
      g.font = '13px sans-serif'
      images.forEach((image, i) => {
        const x = gap + (i % columns) * (cellWidth + gap)
        const y = titleHeight + Math.floor(i / columns) * (cellHeight + labelHeight + gap)
        g.drawImage(image, x, y, cellWidth, cellHeight)
        g.fillStyle = '#C9D1E0'
        g.fillText(cells[i]?.label ?? '', x + 2, y + cellHeight + 16)
      })
      return canvas.toDataURL('image/png')
    },
    {
      title,
      cells: cells.map((c) => ({ label: c.label, png: c.png.toString('base64') })),
      columns,
      cellWidth,
    },
  )
  await page.close()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'))
}
