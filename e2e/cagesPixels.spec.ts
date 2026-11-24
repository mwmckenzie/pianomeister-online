import { fileURLToPath } from 'node:url'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import { frameWith, openSong } from './contactSheet'

/** Cages never tint a note (NoteMask), however opaque they are. */

const CAGES_DEMO = fileURLToPath(new URL('../test-fixtures/midi/cages-demo.mid', import.meta.url))

/** One note on screen: how far its pixels moved, and how far the highway beside it did. */
interface Blob {
  readonly centreX: number
  readonly pixels: number
  readonly noteDiff: number
  readonly besideDiff: number
}

/**
 * Finds the notes in `off` (saturated pixels above the keys, without their antialiased edges)
 * and compares them, and the highway just left and right of them, with `on`.
 */
function compare(
  page: Page,
  off: Buffer,
  on: Buffer,
): Promise<{ readonly blobs: readonly Blob[]; readonly pedalDiff: number }> {
  return page.evaluate(
    async (pngs) => {
      const [a, b] = await Promise.all(
        pngs.map(async (png) => {
          const image = new Image()
          image.src = `data:image/png;base64,${png}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const g = canvas.getContext('2d') as CanvasRenderingContext2D
          g.drawImage(image, 0, 0)
          return g.getImageData(0, 0, image.width, image.height)
        }),
      )
      if (a === undefined || b === undefined) return { blobs: [], pedalDiff: 0 }
      const { width } = a
      const height = Math.floor(a.height * 0.78) // above the keyboard
      const rgb = (d: ImageData, i: number) => [0, 1, 2].map((c) => d.data[4 * i + c] ?? 0)
      const diff = (i: number) => {
        const q = rgb(b, i)
        return Math.max(...rgb(a, i).map((v, c) => Math.abs(v - (q[c] ?? 0))))
      }
      const note = new Uint8Array(width * height)
      for (let i = 0; i < note.length; i++) {
        const p = rgb(a, i)
        note[i] = Math.max(...p) - Math.min(...p) > 60 ? 1 : 0
      }
      // Inside by 2 px: antialiased edges blend with whatever is beside the note.
      const inner = new Uint8Array(note.length)
      for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
          let all = 1
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) all &= note[(y + dy) * width + x + dx] ?? 0
          inner[y * width + x] = all
        }
      }
      const blobs: { centreX: number; pixels: number; noteDiff: number; besideDiff: number }[] = []
      for (let start = 0; start < inner.length; start++) {
        if (inner[start] !== 1) continue
        inner[start] = 2
        const stack = [start]
        let pixels = 0
        let noteDiff = 0
        let [sumX, sumY] = [0, 0]
        for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
          const x = i % width
          pixels++
          noteDiff = Math.max(noteDiff, diff(i))
          sumX += x
          sumY += Math.floor(i / width)
          for (const n of [i - 1, i + 1, i - width, i + width]) {
            if (inner[n] !== 1) continue
            inner[n] = 2
            stack.push(n)
          }
        }
        if (pixels < 30) continue
        // Out from the note's middle, along its row, to just past its edges.
        const middle = Math.round(sumY / pixels) * width + Math.round(sumX / pixels)
        let left = middle
        let right = middle
        while (note[left] === 1) left--
        while (note[right] === 1) right++
        const besideDiff = Math.min(diff(left - 3), diff(right + 3))
        blobs.push({ centreX: sumX / pixels / width, pixels, noteDiff, besideDiff })
      }
      // The highway right of both hands in bar 12: only the pedal cage is there.
      const pedalDiff = diff(Math.floor(a.height * 0.35) * width + Math.floor(width * 0.68))
      return { blobs, pedalDiff }
    },
    [off.toString('base64'), on.toString('base64')],
  )
}

test('@cages notes over the pedal cage and both hand cages keep their colour', async ({ page }) => {
  test.setTimeout(90_000)
  await openSong(page, CAGES_DEMO, 'Cages demo')
  // Bar 11: bar 12 ahead has both hands and the pedal down.
  const frame = (on: boolean) =>
    frameWith(
      page,
      {
        render: { quality: 'off', ...QUALITY_PRESETS.off },
        effects: { enabled: false },
        names: { mode: 'off' },
        // See-through sustains: opaque ones, drawn later, would hide a tint by themselves.
        notes: { sustainCenterTransparency: 0.6 },
        pedal: { show: on, fill: 'solid', fillOpacity: 0.5 },
        handCages: { show: on, rightFill: 'solid', leftFill: 'solid', fillOpacity: 0.5 },
      },
      11,
    )
  const { blobs, pedalDiff } = await compare(page, await frame(false), await frame(true))
  expect(pedalDiff).toBeGreaterThan(20)
  const overCage = blobs.filter((b) => b.besideDiff > 20)
  // The left hand's chord and the right hand's notes, both over visible cages.
  expect(overCage.filter((b) => b.centreX < 0.5).length).toBeGreaterThanOrEqual(3)
  expect(overCage.filter((b) => b.centreX > 0.5).length).toBeGreaterThanOrEqual(3)
  expect(Math.max(...overCage.map((b) => b.noteDiff))).toBeLessThanOrEqual(4)
})
