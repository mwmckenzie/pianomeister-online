import { mkdirSync, writeFileSync } from 'node:fs'

import { expect, test } from './fixtures'

import { BUILT_IN_LOOKS } from '../src/core/looks/BUILT_IN_LOOKS'
import type { Look } from '../src/core/looks/Look'
import { QUALITY_PRESETS } from '../src/core/settings/QUALITY_PRESETS'
import type { QualityPreset } from '../src/core/settings/QualityPreset'
import {
  type Cell,
  captureWith,
  type Crop,
  LONG_DEMO,
  openSong,
  type Settings,
  writeSheet,
} from './contactSheet'
import { watchErrors } from './support'

/**
 * Milestone 9.1 section C (npm run test:visual -- -g looks): every built-in look at 1280×720,
 * playing the long demo's dense chords (bar 2) on the fixed step (`?capture=1`), 0.2 s in, so
 * onsets are mid-burst and sustain effects running. Each look uses its own camera (looks hold
 * it). Frames: test-results/visual/looks/<id>.<off|medium>.png (a look must read at Off: bloom
 * only adds). The sheet test-results/visual/looks/all-looks.png shows each look at Medium twice,
 * the full frame and a closer crop near the keys, then the four most bloom-dependent looks at
 * Off.
 */
const OUT = 'test-results/visual/looks'
const MOMENT = 0.2

/** Near the keys, where the notes arrive and the effects burst; 16:9 like the full frame. */
const NEAR_KEYS: Crop = { x: 240, y: 270, width: 800, height: 450 }

/** Looks whose character leans most on bloom: their Off frames go on the sheet too. */
const BLOOM_HEAVY = ['Neon', 'Synthwave', 'Inferno', 'Fireworks']

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
  await openSong(page, LONG_DEMO, 'Long demo')
  const shoot = async (look: Look, quality: QualityPreset, crop?: Crop): Promise<Buffer> => {
    const { pngs } = await captureWith(page, settingsOf(look, quality), 2, [MOMENT], crop)
    return pngs[0] as Buffer
  }
  const medium: Cell[] = []
  const off = new Map<string, Buffer>()
  for (const look of BUILT_IN_LOOKS) {
    const full = await shoot(look, 'medium')
    writeFileSync(`${OUT}/${slug(look)}.medium.png`, full)
    medium.push({ label: look.name, png: full })
    medium.push({
      label: `${look.name} · near the keys`,
      png: await shoot(look, 'medium', NEAR_KEYS),
    })
    const atOff = await shoot(look, 'off')
    writeFileSync(`${OUT}/${slug(look)}.off.png`, atOff)
    off.set(look.name, atOff)
  }
  const offRow = BLOOM_HEAVY.map((name) => ({
    label: `${name} · quality Off`,
    png: off.get(name) as Buffer,
  }))
  await writeSheet(
    browser,
    `${OUT}/all-looks.png`,
    `Built-in looks — Medium (full frame, near the keys), then Off for the bloom-heavy four · long demo bar 2, ${MOMENT} s in, fixed step`,
    [...medium, ...offRow],
    4,
    480,
  )
  expect(medium).toHaveLength(BUILT_IN_LOOKS.length * 2)
  expect(offRow.every((c) => c.png !== undefined)).toBe(true)
  expect(errors).toEqual([])
})
