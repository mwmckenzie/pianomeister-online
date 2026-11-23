import { mkdirSync } from 'node:fs'

import { expect, test } from './fixtures'

import {
  BLACK_NOTES_DEMO,
  type Cell,
  captureWith,
  type Crop,
  openSong,
  PEDAL_DEMO,
  type Settings,
  writeSheet,
} from './contactSheet'
import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import { watchErrors } from './support'

/**
 * Milestone 9.2 review sheets (npm run test:visual -- -g "practice clarity"), written to
 * test-results/visual/m9-2/. `SHEET_TAG` (e.g. before / after) is added to the file names, so a
 * run on the old code can sit beside a run on the new one.
 */
const OUT = 'test-results/visual/m9-2'
const TAG = process.env.SHEET_TAG ? `.${process.env.SHEET_TAG}` : ''

test.use({ viewport: { width: 1280, height: 720 } })

/** The Pedal demo's first chords press white keys next to black ones, on the left. */
const KEYS_CROP: Record<number, Crop> = {
  25: { x: 400, y: 590, width: 240, height: 120 },
  85: { x: 400, y: 560, width: 240, height: 160 },
}
/** `SHEET_FULL=1` shows whole frames, for finding the crops. */
function keysCrop(tilt: number): Crop | undefined {
  return process.env.SHEET_FULL ? undefined : KEYS_CROP[tilt]
}
/** A press takes 0.04 s: 0.017 s and 0.034 s catch it at about 40% and 85%; 0.3 s is held. */
const MOMENTS = [0.017, 0.034, 0.3]

test('@visual practice clarity: keys pressed next to black keys', async ({ page, browser }) => {
  test.setTimeout(1_200_000)
  const errors = watchErrors(page)
  mkdirSync(OUT, { recursive: true })
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const cells: Cell[] = []
  for (const tilt of [25, 85]) {
    const crop = keysCrop(tilt)
    const { pngs } = await captureWith(page, { camera: { tiltDeg: tilt } }, 1, MOMENTS, crop)
    pngs.forEach((png, i) => cells.push({ label: `tilt ${tilt}° · ${MOMENTS[i]} s`, png }))
    for (const white of [0.4, 0.6]) {
      const shot = await captureWith(
        page,
        { camera: { tiltDeg: tilt }, keyboard: { pressDepthWhite: white } },
        1,
        [0.3],
        crop,
      )
      cells.push({ label: `tilt ${tilt}° · white key depth ${white}`, png: shot.pngs[0] as Buffer })
    }
    for (const depth of [0, 0.15, 0.3, 0.43]) {
      const shot = await captureWith(
        page,
        { camera: { tiltDeg: tilt }, keyboard: { pressDepthBlack: depth } },
        1,
        [0.3],
        crop,
      )
      cells.push({ label: `tilt ${tilt}° · black key depth ${depth}`, png: shot.pngs[0] as Buffer })
    }
  }
  await writeSheet(
    browser,
    `${OUT}/keys${TAG}.png`,
    `Keys: white keys pressed next to black keys · Pedal demo bar 1, fixed step${TAG}`,
    cells,
    9,
    480,
  )
  expect(cells).toHaveLength(18)
  expect(errors).toEqual([])
})

/** Black notes on the highway (section B): each variant from three tilts, at quality Off and Medium. */
const NOTE_VARIANTS: readonly { label: string; notes: Settings[string] }[] = [
  { label: 'defaults (white 0.35, black 0.6)', notes: {} },
  {
    label: 'low (white 0.15, black 0.25)',
    notes: { whiteHeadHeight: 0.15, blackHeadHeight: 0.25 },
  },
  { label: 'tall (white 0.6, black 0.8)', notes: { whiteHeadHeight: 0.6, blackHeadHeight: 0.8 } },
  { label: 'raised black sustains', notes: { blackRidge: true } },
  { label: 'ridges at 0.35', notes: { blackRidge: true, blackRidgeHeight: 0.35 } },
  { label: 'no side shading, no outline', notes: { blackSideShading: 0, blackOutline: false } },
]
/** Around the chords near the keys, where heads, sustains and ridges overlap. */
const NOTES_CROP: Record<number, Crop> = {
  25: { x: 480, y: 250, width: 360, height: 203 },
  45: { x: 460, y: 300, width: 400, height: 225 },
  85: { x: 460, y: 290, width: 400, height: 225 },
}
function notesCrop(tilt: number): Crop | undefined {
  return process.env.SHEET_FULL ? undefined : NOTES_CROP[tilt]
}

test('@visual practice clarity: black notes on the highway', async ({ page, browser }) => {
  test.setTimeout(1_800_000)
  const errors = watchErrors(page)
  mkdirSync(OUT, { recursive: true })
  await openSong(page, BLACK_NOTES_DEMO, 'Black notes demo')
  for (const quality of ['off', 'medium'] as const) {
    const cells: Cell[] = []
    for (const tilt of [25, 45, 85]) {
      for (const variant of NOTE_VARIANTS) {
        const { pngs } = await captureWith(
          page,
          {
            camera: { tiltDeg: tilt },
            notes: variant.notes,
            render: { quality, ...QUALITY_PRESETS[quality] },
          },
          1,
          [2.2],
          notesCrop(tilt),
        )
        cells.push({ label: `${tilt}° · ${variant.label}`, png: pngs[0] as Buffer })
      }
    }
    await writeSheet(
      browser,
      `${OUT}/black-notes.${quality}${TAG}.png`,
      `Black notes on the highway · quality ${quality} · Black notes demo, 2.2 s in (the chords just before the keys)${TAG}`,
      cells,
      NOTE_VARIANTS.length,
      480,
    )
    expect(cells).toHaveLength(NOTE_VARIANTS.length * 3)
  }
  expect(errors).toEqual([])
})
