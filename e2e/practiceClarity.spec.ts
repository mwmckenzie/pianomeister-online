import { mkdirSync, writeFileSync } from 'node:fs'

import { expect, test } from './fixtures'

import {
  BLACK_NOTES_DEMO,
  type CaptureLoop,
  type Cell,
  captureWith,
  type Crop,
  LONG_DEMO,
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
  35: { x: 490, y: 282, width: 340, height: 191 },
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
    for (const tilt of [25, 35, 45, 85]) {
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
    expect(cells).toHaveLength(NOTE_VARIANTS.length * 4)
  }
  expect(errors).toEqual([])
})

/**
 * Loop visibility (section A): a short loop (bar 3, two beats of pre-roll) seen from just inside
 * it, and a long loop (bars 2–5, no pre-roll) seen near its end; each in both "After the loop
 * end" modes, at dim 0 / default / max, and without the boundary lines. Long demo, 132 bpm.
 */
const LOOPS: readonly { label: string; loop: CaptureLoop; bar: number }[] = [
  {
    label: 'short loop (bar 3, pre-roll 2)',
    loop: { startBar: 3, endBar: 3, preRollBeats: 2 },
    bar: 3,
  },
  { label: 'long loop (bars 2–5)', loop: { startBar: 2, endBar: 5 }, bar: 5 },
]
const LOOP_VARIANTS: readonly { label: string; loop: Settings[string] }[] = [
  { label: 'Next repeat (default)', loop: {} },
  { label: 'Song continues', loop: { after: 'continue' } },
  { label: 'dim 0', loop: { dimStrength: 0 } },
  { label: 'dim 95% (max)', loop: { dimStrength: 0.95 } },
  { label: 'no boundary lines', loop: { lines: false } },
]

test('@visual practice clarity: loop on the highway', async ({ page, browser }) => {
  test.setTimeout(1_800_000)
  const errors = watchErrors(page)
  mkdirSync(OUT, { recursive: true })
  await openSong(page, LONG_DEMO, 'Long demo')
  for (const quality of ['off', 'medium'] as const) {
    const cells: Cell[] = []
    for (const { label, loop, bar } of LOOPS) {
      for (const variant of LOOP_VARIANTS) {
        const { pngs } = await captureWith(
          page,
          { loop: variant.loop, render: { quality, ...QUALITY_PRESETS[quality] } },
          bar,
          [0.3],
          undefined,
          '',
          loop,
        )
        cells.push({ label: `${label} · ${variant.label}`, png: pngs[0] as Buffer })
      }
    }
    await writeSheet(
      browser,
      `${OUT}/loop.${quality}${TAG}.png`,
      `Loop on the highway · quality ${quality} · long demo, 0.3 s into the frame's bar${TAG}`,
      cells,
      LOOP_VARIANTS.length,
      480,
    )
    expect(cells).toHaveLength(LOOPS.length * LOOP_VARIANTS.length)
  }
  expect(errors).toEqual([])
})

/**
 * A.5: draw calls per frame (every pass) with no loop, a long loop, a short loop and a one-bar
 * loop at the maximum look-ahead, at quality Off and Medium: test-results/visual/m9-2/draw-calls.json.
 */
test('@visual practice clarity: loop repeat draw calls', async ({ page }) => {
  test.setTimeout(600_000)
  await openSong(page, LONG_DEMO, 'Long demo')
  const cases: readonly {
    label: string
    loop: CaptureLoop | null
    bar: number
    lookAhead: number
  }[] = [
    { label: 'no loop', loop: null, bar: 3, lookAhead: 10 },
    {
      label: 'long loop, bars 2-5, near its end',
      loop: { startBar: 2, endBar: 5 },
      bar: 5,
      lookAhead: 10,
    },
    {
      label: 'short loop, bar 3, pre-roll 2',
      loop: { startBar: 3, endBar: 3, preRollBeats: 2 },
      bar: 3,
      lookAhead: 10,
    },
    { label: 'no loop, look-ahead 32', loop: null, bar: 3, lookAhead: 32 },
    {
      label: 'one-bar loop, bar 3, look-ahead 32',
      loop: { startBar: 3, endBar: 3 },
      bar: 3,
      lookAhead: 32,
    },
  ]
  const results: Record<string, Record<string, number>> = {}
  for (const quality of ['off', 'medium'] as const) {
    for (const c of cases) {
      await captureWith(
        page,
        {
          highway: { lookAheadBeats: c.lookAhead },
          render: { quality, ...QUALITY_PRESETS[quality] },
        },
        c.bar,
        [0.3],
        undefined,
        '&stats=1',
        c.loop,
      )
      const calls = await page.evaluate(
        () =>
          (
            window as unknown as { pianomeisterRenderInfo: () => { drawCalls: number } | null }
          ).pianomeisterRenderInfo()?.drawCalls ?? -1,
      )
      ;(results[c.label] ??= {})[quality] = calls
    }
  }
  writeFileSync(`${OUT}/draw-calls.json`, JSON.stringify(results, null, 2))
  expect(Object.keys(results)).toHaveLength(cases.length)
})

/**
 * Round-2 fix: a white head directly in front of a taller black head must cover it (depth
 * tested), while a black sustain over a white sustain still wins. Black notes demo 2.6 s in:
 * the C major chord's heads just in front of the C♯ and F♯ heads, close to the keys.
 */
const OCCLUSION_CROP: Record<number, Crop> = {
  25: { x: 492, y: 375, width: 200, height: 113 },
  35: { x: 492, y: 405, width: 200, height: 113 },
  45: { x: 492, y: 425, width: 200, height: 113 },
  85: { x: 492, y: 440, width: 200, height: 113 },
}
function occlusionCrop(tilt: number): Crop | undefined {
  return process.env.SHEET_FULL ? undefined : OCCLUSION_CROP[tilt]
}

test('@visual practice clarity: nearer white heads cover farther black heads', async ({
  page,
  browser,
}) => {
  test.setTimeout(900_000)
  mkdirSync(OUT, { recursive: true })
  await openSong(page, BLACK_NOTES_DEMO, 'Black notes demo')
  const cells: Cell[] = []
  for (const tilt of [25, 35, 45, 85]) {
    // Two-tone, so the white and black notes can be told apart where they meet.
    for (const [label, heights] of [
      ['defaults', {}],
      ['tall (white 0.6, black 0.8)', { whiteHeadHeight: 0.6, blackHeadHeight: 0.8 }],
    ] as const) {
      const notes = { palette: 'twoTone', ...heights }
      const { pngs } = await captureWith(
        page,
        { camera: { tiltDeg: tilt }, notes },
        1,
        [0.9],
        occlusionCrop(tilt),
      )
      cells.push({ label: `${tilt}° · ${label}`, png: pngs[0] as Buffer })
    }
  }
  await writeSheet(
    browser,
    `${OUT}/occlusion${TAG}.png`,
    `White heads in front of taller black heads · Black notes demo 0.9 s in (A3 and B3, A♯3 a 32nd later)${TAG}`,
    cells,
    4,
    480,
  )
  expect(cells).toHaveLength(8)
})
