import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { BUILT_IN_LOOKS } from '../src/core/looks/BUILT_IN_LOOKS'
import { lookSettings } from '../src/core/looks/lookValues'
import { DEFAULT_SETTINGS } from '../src/core/settings/DEFAULT_SETTINGS'
import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import {
  captureWith,
  type Cell,
  frameWith,
  openSong,
  type Settings,
  writeSheet,
} from './contactSheet'

/**
 * Milestone 10 contact sheets (npm run test:visual -- -g "cages sheet"), committed as JPEGs in
 * docs/design/m10/: the cages demo (rests, held notes, a 4/4 → 3/4 → 4/4 change, both keyboard
 * ends) at three tilts and two qualities, two looks with cages, the carried-bars strength, the
 * fill and border ranges, a loop with Next repeat; and draw calls with cages on and off.
 */
const OUT = 'docs/design/m10'
const CAGES_DEMO = fileURLToPath(new URL('../test-fixtures/midi/cages-demo.mid', import.meta.url))

const look = (id: string): Settings => {
  const found = BUILT_IN_LOOKS.find((l) => l.id === id)
  if (found === undefined) throw new Error(id)
  return lookSettings(DEFAULT_SETTINGS, found) as unknown as Settings
}

/** `base` with `extra` merged section by section. */
const merge = (base: Settings, extra: Settings): Settings => {
  const out: Settings = { ...base }
  for (const [section, fields] of Object.entries(extra))
    out[section] = { ...out[section], ...fields }
  return out
}

const quality = (q: 'off' | 'medium') => ({ render: { quality: q, ...QUALITY_PRESETS[q] } })
const CLASSIC_CAGES = merge(look('builtin:classic'), { handCages: { show: true } })

async function open(page: Page): Promise<void> {
  await openSong(page, CAGES_DEMO, 'Cages demo')
}

test('@visual cages sheet: tilt and quality, bars 3 and 9 (Classic with cages on)', async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000)
  await open(page)
  const cells: Cell[] = []
  for (const tilt of [25, 35, 85]) {
    for (const q of ['off', 'medium'] as const) {
      for (const bar of [3, 9]) {
        const settings = merge(merge(CLASSIC_CAGES, quality(q)), { camera: { tiltDeg: tilt } })
        cells.push({
          label: `${tilt}° · ${q} · bar ${bar}`,
          png: await frameWith(page, settings, bar),
        })
      }
    }
  }
  await writeSheet(
    browser,
    `${OUT}/cages.tilt-quality.jpg`,
    'Hand cages · Classic with cages on · tilt × quality · bar 3 (narrow, carried 4–5, leading rest) and bar 9 (3/4, keyboard ends)',
    cells,
    4,
    420,
  )
  expect(cells).toHaveLength(12)
})

test('@visual cages sheet: looks, carried strength, fill and border ranges', async ({
  page,
  browser,
}) => {
  test.setTimeout(600_000)
  await open(page)
  const looks: Cell[] = []
  for (const id of ['builtin:study', 'builtin:blueprint']) {
    for (const bar of [3, 9]) {
      looks.push({
        label: `${id.slice(8)} · bar ${bar}`,
        png: await frameWith(page, merge(look(id), quality('medium')), bar),
      })
    }
  }
  await writeSheet(
    browser,
    `${OUT}/cages.looks.jpg`,
    'Looks with hand cages (Medium, 35°)',
    looks,
    4,
    420,
  )

  const ranges: Cell[] = []
  const at = (label: string, cages: Record<string, unknown>) =>
    frameWith(page, merge(merge(CLASSIC_CAGES, quality('medium')), { handCages: cages }), 3).then(
      (png) => ranges.push({ label, png }),
    )
  for (const carried of [0, 0.5, 1]) await at(`carried bars ${carried * 100}%`, { carried })
  for (const fillOpacity of [0.05, 0.12, 0.3])
    await at(`fill opacity ${fillOpacity * 100}%`, { fillOpacity })
  for (const borderWidth of [0.02, 0.04, 0.12])
    await at(`border width ${borderWidth}`, { borderWidth })
  await writeSheet(
    browser,
    `${OUT}/cages.ranges.jpg`,
    'Carried bars (bars 4–5 rest), fill opacity and border width (Classic with cages, Medium, bar 3)',
    ranges,
    3,
    520,
  )
  expect(looks).toHaveLength(4)
  expect(ranges).toHaveLength(9)
})

test('@visual cages sheet: a loop with Next repeat, and draw calls', async ({ page, browser }) => {
  test.setTimeout(600_000)
  await open(page)
  const loopCells: Cell[] = []
  for (const q of ['off', 'medium'] as const) {
    const { pngs } = await captureWith(
      page,
      merge(merge(CLASSIC_CAGES, quality(q)), { loop: { after: 'repeat' } }),
      3,
      [1.5],
      undefined,
      '',
      { startBar: 3, endBar: 4 },
    )
    loopCells.push({ label: `loop bars 3–4, Next repeat · ${q}`, png: pngs[0] as Buffer })
  }
  await writeSheet(
    browser,
    `${OUT}/cages.loop.jpg`,
    'Hand cages in a loop (Next repeat)',
    loopCells,
    2,
    640,
  )

  const calls: Record<string, Record<string, number>> = {}
  for (const q of ['off', 'medium'] as const) {
    for (const show of [false, true]) {
      await captureWith(
        page,
        merge(merge(CLASSIC_CAGES, quality(q)), { handCages: { show } }),
        3,
        [0.3],
        undefined,
        '&stats=1',
      )
      const n = await page.evaluate(
        () =>
          (
            window as unknown as { pianomeisterRenderInfo: () => { drawCalls: number } | null }
          ).pianomeisterRenderInfo()?.drawCalls ?? -1,
      )
      ;(calls[q] ??= {})[show ? 'cages on' : 'cages off'] = n
    }
  }
  writeFileSync(`${OUT}/draw-calls.json`, `${JSON.stringify(calls, null, 2)}\n`)
  expect(Object.keys(calls)).toHaveLength(2)
})
