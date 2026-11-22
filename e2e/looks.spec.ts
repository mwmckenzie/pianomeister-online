import { mkdirSync, writeFileSync } from 'node:fs'

import { expect, test } from './fixtures'

import { BUILT_IN_LOOKS } from '../src/core/looks/BUILT_IN_LOOKS'
import type { Look } from '../src/core/looks/Look'
import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import type { QualityPreset } from '../src/core/settings/QualityPreset'
import {
  type Cell,
  captureWith,
  openSong,
  PEDAL_DEMO,
  type Settings,
  writeSheet,
} from './contactSheet'
import { watchErrors } from './support'

/**
 * Milestone 9.1 section C (npm run test:visual -- -g looks): every built-in look at 1280×720, at
 * quality Off (no bloom: a look must read without it) and Medium. Each is captured playing on
 * the fixed step (`?capture=1`) from the Pedal demo's bar 2, 0.4 s in, so onsets, sustain
 * effects and the pulse show. Frames: test-results/visual/looks/<id>.<quality>.png; every look at
 * Medium on one page: test-results/visual/looks/all-looks.png.
 */
const OUT = 'test-results/visual/looks'
const MOMENT = 0.4

test.use({ viewport: { width: 1280, height: 720 } })

/** A look's flat values and a quality preset as stored settings. */
function settingsOf(look: Look, quality: QualityPreset): Settings {
  const out: Settings = {}
  for (const [key, value] of Object.entries(look.values)) {
    const [section, field] = key.split('.') as [string, string]
    out[section] = { ...out[section], [field]: value }
  }
  out.render = { ...out.render, quality, ...QUALITY_PRESETS[quality] }
  return out
}

const slug = (look: Look) => look.id.replace('builtin:', '')

test('@visual looks: every built-in look at Off and Medium, and the all-looks sheet', async ({
  page,
  browser,
}) => {
  test.setTimeout(1_800_000)
  const errors = watchErrors(page)
  mkdirSync(OUT, { recursive: true })
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const medium: Cell[] = []
  const shoot = async (look: Look, quality: QualityPreset): Promise<Buffer> => {
    const { pngs } = await captureWith(page, settingsOf(look, quality), 2, [MOMENT])
    const png = pngs[0] as Buffer
    writeFileSync(`${OUT}/${slug(look)}.${quality}.png`, png)
    return png
  }
  for (const look of BUILT_IN_LOOKS) {
    await shoot(look, 'off')
    medium.push({ label: look.name, png: await shoot(look, 'medium') })
  }
  await writeSheet(
    browser,
    `${OUT}/all-looks.png`,
    `Built-in looks — quality Medium, Pedal demo bar 2, ${MOMENT} s in (fixed step)`,
    medium,
    4,
    480,
  )
  expect(medium).toHaveLength(BUILT_IN_LOOKS.length)
  expect(errors).toEqual([])
})
