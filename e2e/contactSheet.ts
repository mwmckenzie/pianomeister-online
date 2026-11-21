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
 * (`?animTime=3`) and the song stepped to the start of `bar`; canvas only.
 */
export async function frameWith(
  page: Page,
  settings: Settings,
  bar: number,
  crop?: Crop,
): Promise<Buffer> {
  await page.evaluate(
    (value) => localStorage.setItem('pianomeister.settings', value),
    JSON.stringify({ version: SETTINGS_VERSION, settings }),
  )
  await page.goto('./#/?animTime=3')
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
