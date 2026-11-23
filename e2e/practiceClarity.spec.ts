import { mkdirSync } from 'node:fs'

import { expect, test } from './fixtures'

import { type Cell, captureWith, type Crop, openSong, PEDAL_DEMO, writeSheet } from './contactSheet'
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
