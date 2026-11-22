import { mkdirSync, writeFileSync } from 'node:fs'

import { type Page } from '@playwright/test'
import { expect, test } from './fixtures'

import { COST_KEYS } from '../src/core/looks/COST_KEYS'
import type { SettingKey } from '../src/core/settings/SettingKey'
import { DEFAULT_SETTINGS } from '../src/core/settings/DEFAULT_SETTINGS'
import type { PlayerSettings } from '../src/core/settings/PlayerSettings'
import { SETTING_KEYS } from '../src/core/settings/SETTING_KEYS'
import { formatSettingValue } from '../src/core/settings/formatSettingValue'
import { settingDefinition } from '../src/core/settings/settingValues'
import {
  type Cell,
  type Crop,
  captureWith,
  frameWith,
  LONG_DEMO,
  openSong,
  type ParticleLoad,
  PEDAL_DEMO,
  type Settings,
  writeSheet,
} from './contactSheet'

/**
 * Milestone 9.1 section B (npm run test:visual -- -g range): for every numeric playfield
 * setting, the same frame at 7 values — min, the default, and 5 spread to the max (log-spaced
 * where the effect is perceptual) — on the Pedal demo, bar 2, `?animTime=3`, 1280×720, at the
 * defaults. Effects that need motion (onsets, sustain particles, pulse) are captured playing on
 * a fixed step (`?capture=1`): onsets and sustain particles on the long demo's dense chords
 * at Medium (budget 2048), which also logs where the particle budget starts truncating. Then
 * the 4×4 grids of settings that interact. Sheets: test-results/visual/ranges/<section>/<key>.png.
 */
const OUT = 'test-results/visual/ranges'

test.use({ viewport: { width: 1280, height: 720 } })

const ONSETS = ['sparks', 'scalingSparks', 'flame', 'explosion', 'glitter'] as const
const KNOBS = ['Size', 'Count', 'Lifetime', 'Spread'] as const

/** Every onset effect off but `only` (so a knob is judged on its own). */
function onsetOnly(only: (typeof ONSETS)[number] | null): Record<string, boolean> {
  return Object.fromEntries(ONSETS.map((e) => [e, e === only]))
}

/** What has to be on for a setting to show (its row's `visible`), and nothing else. */
function prerequisites(key: SettingKey): Settings {
  const [section, field] = key.split('.') as [string, string]
  if (key.startsWith('lines.borders')) return { lines: { borders: true } }
  if (key.startsWith('lines.octaves')) return { lines: { octaves: true } }
  if (key === 'noteStyle.gradientEnd') {
    return { noteStyle: { headFill: 'gradient', sustainFill: 'gradient' } }
  }
  if (field.startsWith('headStripe')) return { noteStyle: { headFill: 'stripes' } }
  if (field.startsWith('sustainStripe')) return { noteStyle: { sustainFill: 'stripes' } }
  if (field.startsWith('edge') && section === 'noteStyle') return { noteStyle: { edgeGlow: true } }
  if (key === 'notes.blackLift') return { notes: { blackLiftMode: 'manual' } }
  if (key === 'names.keySize') return { names: { mode: 'both' } }
  if (section === 'names') return { names: { mode: 'notes' } }
  if (key.startsWith('pedal.border') || key === 'pedal.cornerRadius') {
    return { pedal: { border: true } }
  }
  if (field.startsWith('stripe') && section === 'pedal') return { pedal: { fill: 'stripes' } }
  const onset = ONSETS.find((e) => KNOBS.some((k) => field === `${e}${k}`))
  if (onset !== undefined) return { effects: onsetOnly(onset) }
  if (key === 'effects.minScale' || key === 'effects.maxScale') {
    return { effects: onsetOnly('sparks') }
  }
  if (field.startsWith('sustain') && section === 'effects') {
    return { effects: { ...onsetOnly(null), sustain: 'embers' } }
  }
  if (field.startsWith('pulse')) return { effects: { ...onsetOnly(null), pulse: true } }
  if (field.startsWith('soundingGlow')) return { effects: { soundingGlow: true } }
  if (field.startsWith('keySpill')) return { effects: { keySpill: true } }
  if (field.startsWith('keyCone')) return { effects: { keyCone: true } }
  return {}
}

/** Perceptual settings (sizes, widths, strengths, counts, lifetimes, decay): log-spaced. */
function isLog(key: SettingKey): boolean {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return false
  if (def.unit === 'times') return true
  if (/Width$|Size$|edgeSize|pulseDecayMs|cornerRadius|keySpillSpread|fadeLength/.test(key)) {
    return true
  }
  return false
}

const round = (v: number) => Number(v.toPrecision(6))

/** `count` values from `lo` to `hi`, snapped to the step (log when perceptual). */
function spread(key: SettingKey, fractions: readonly number[]): number[] {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return []
  const { min, max, step } = def
  const lo = isLog(key) ? Math.max(min, step) : min
  const at = (f: number) => (isLog(key) ? lo * (max / lo) ** f : min + (max - min) * f)
  return fractions.map((f) => round(min + Math.round((at(f) - min) / step) * step))
}

/** Min, the default, and 5 points spread to the max. */
function valuesOf(key: SettingKey): number[] {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return []
  const all = [def.min, def.default, ...spread(key, [0.2, 0.4, 0.6, 0.8, 1])]
  return [...new Set(all.map(round))].sort((a, b) => a - b)
}

/**
 * Fails when `key` would be hidden (so inert) under `patch` over the defaults: a sheet of a
 * setting that does nothing looks like a setting with no visible effect.
 */
function expectShown(key: SettingKey, patch: Settings): void {
  const defaults = DEFAULT_SETTINGS as unknown as Settings
  const merged: Settings = { ...defaults }
  for (const [section, fields] of Object.entries(patch)) {
    merged[section] = { ...defaults[section], ...fields }
  }
  const visible = settingDefinition(key).visible
  expect(visible?.(merged as unknown as PlayerSettings) ?? true, `${key} is hidden`).toBe(true)
}

/** Writes a nested settings patch for one key over its prerequisites. */
function withValue(base: Settings, key: SettingKey, value: unknown): Settings {
  const [section, field] = key.split('.') as [string, string]
  return { ...base, [section]: { ...base[section], [field]: value } }
}

/*
 * Crops near 1:1 (CSS px of the 1280×720 frame), so thin lines, small heads and keys can be
 * judged: each setting is shown where it acts. Whole-frame settings (camera, look-ahead,
 * vignette, bloom) keep the full frame.
 */
/** The pressed keys on the left of the Pedal demo at bar 2. */
const KEYS_CROP: Crop = { x: 240, y: 540, width: 440, height: 180 }
const LABELS_CROP: Crop = { x: 300, y: 260, width: 680, height: 460 }
/** The now line where it meets the keyboard. */
const NOW_LINE_CROP: Crop = { x: 340, y: 520, width: 600, height: 200 }
/** The highway's left border, near to far. */
const BORDER_CROP: Crop = { x: 20, y: 240, width: 440, height: 400 }
/** Lane, bar, beat and octave lines and lane shading, mid-highway. */
const GRID_CROP: Crop = { x: 300, y: 120, width: 680, height: 420 }
/** The near notes: sustains and heads. */
const NOTES_CROP: Crop = { x: 260, y: 260, width: 520, height: 420 }
/** The now line on the long demo's dense chords: onsets and sustain particles. */
const PARTICLES_CROP: Crop = { x: 190, y: 360, width: 900, height: 320 }
/** The Pedal demo's notes reaching the keys: pulse, sounding glow, key light. */
const ARRIVAL_CROP: Crop = { x: 240, y: 380, width: 560, height: 340 }

function cropOf(key: SettingKey): Crop | undefined {
  const field = key.split('.')[1] ?? ''
  if (motionOf(key)?.song === 'long') return PARTICLES_CROP
  if (/pulse|soundingGlow|keySpill|keyCone/.test(field)) return ARRIVAL_CROP
  if (key.startsWith('keyboard.') || key.startsWith('keys.')) {
    return KEYS_CROP
  }
  if (key.startsWith('names.')) return LABELS_CROP
  if (field.startsWith('now')) return NOW_LINE_CROP
  if (field.startsWith('borders')) return BORDER_CROP
  if (/octaves|barGlow|beatGlow|blackLaneShading/.test(field) || key.startsWith('opacity.')) {
    return GRID_CROP
  }
  if (key.startsWith('notes.') || key.startsWith('noteStyle.')) return NOTES_CROP
  return undefined
}

/** Settings whose effect only shows in motion, and how to capture it. */
function motionOf(key: SettingKey): { song: 'long' | 'pedal'; moments: number[] } | null {
  const field = key.split('.')[1] ?? ''
  if (!key.startsWith('effects.')) return null
  if (ONSETS.some((e) => KNOBS.some((k) => field === `${e}${k}`))) {
    return { song: 'long', moments: [0.15, 0.5, 1.2] }
  }
  if (key === 'effects.minScale' || key === 'effects.maxScale') {
    return { song: 'long', moments: [0.15, 0.5, 1.2] }
  }
  if (field.startsWith('sustain')) return { song: 'long', moments: [0.5, 1.2, 2.5] }
  if (field.startsWith('pulse')) return { song: 'pedal', moments: [0.05, 0.15, 0.4] }
  return null
}

/** The playfield sidebar's numeric settings (device cost aside), by section. */
const RANGED = SETTING_KEYS.filter((key) => {
  const def = settingDefinition(key)
  return def.home.area === 'sidebar' && def.kind === 'number' && !COST_KEYS.has(key)
})

function sectionOf(key: SettingKey): string {
  const home = settingDefinition(key).home
  return home.area === 'sidebar' ? home.section : 'other'
}

/** As the slider shows it, with the stored value when they differ (so ranges.md can quote it). */
function label(key: SettingKey, value: number): string {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return String(value)
  const shown = formatSettingValue(def, value)
  const raw = shown === String(value) ? '' : ` [${value}]`
  const mark = round(def.default) === value ? '  (default)' : ''
  return `${shown}${raw}${mark}`
}

function title(key: SettingKey, extra = ''): string {
  const def = settingDefinition(key)
  if (def.kind !== 'number') return key
  const scale = isLog(key) ? 'log' : 'lin'
  return `${key} — ${def.label}: ${def.min}..${def.max} step ${def.step}, default ${round(def.default)} (${scale})${extra}`
}

const budgets: Record<string, { value: number; load: ParticleLoad }[]> = {}

function saveBudgets(name: string): void {
  mkdirSync(`${OUT}/budget`, { recursive: true })
  writeFileSync(`${OUT}/budget/${name}.json`, JSON.stringify(budgets, null, 2))
}

async function rangeSheet(page: Page, browser: Parameters<typeof writeSheet>[0], key: SettingKey) {
  const base = prerequisites(key)
  expectShown(key, base)
  const motion = motionOf(key)
  const cells: Cell[] = []
  for (const value of valuesOf(key)) {
    const settings = withValue(base, key, value)
    if (motion === null) {
      cells.push({ label: label(key, value), png: await frameWith(page, settings, 2, cropOf(key)) })
      continue
    }
    const { pngs, load } = await captureWith(page, settings, 2, motion.moments, cropOf(key))
    pngs.forEach((png, i) =>
      cells.push({ label: `${label(key, value)} · t ${motion.moments[i]} s`, png }),
    )
    ;(budgets[key] ??= []).push({ value, load })
  }
  const crop = cropOf(key)
  // Near 1:1 for crops (at most 640 px), two rows of four for still frames.
  const width = Math.min(640, crop?.width ?? 640)
  await writeSheet(
    browser,
    `${OUT}/${sectionOf(key)}/${key}.png`,
    title(key, motion === null ? '' : ' — playing, fixed step'),
    cells,
    motion === null ? 4 : motion.moments.length,
    width,
  )
  return cells.length
}

/** Static sections on the Pedal demo; motion keys open the song they need. */
const GROUPS: readonly { readonly name: string; readonly keys: readonly SettingKey[] }[] = [
  ...[
    'camera',
    'keyboard',
    'highway',
    'lines',
    'notes',
    'noteStyle',
    'names',
    'cages',
    'render',
  ].map((section) => ({
    name: section,
    keys: RANGED.filter((k) => sectionOf(k) === section),
  })),
  {
    name: 'effects-static',
    keys: RANGED.filter((k) => sectionOf(k) === 'effects' && motionOf(k) === null),
  },
  ...ONSETS.map((e) => ({
    name: `effects-${e}`,
    keys: RANGED.filter((k) => KNOBS.some((knob) => k === `effects.${e}${knob}`)),
  })),
  {
    name: 'effects-motion',
    keys: RANGED.filter(
      (k) =>
        motionOf(k) !== null &&
        !ONSETS.some((e) => KNOBS.some((knob) => k === `effects.${e}${knob}`)),
    ),
  },
]

/** Renders a group's sheets, opening each song its keys need once. */
async function runGroup(
  page: Page,
  browser: Parameters<typeof writeSheet>[0],
  keys: readonly SettingKey[],
): Promise<number> {
  const songOf = (k: SettingKey) => motionOf(k)?.song ?? 'pedal'
  let sheets = 0
  for (const song of ['pedal', 'long'] as const) {
    const mine = keys.filter((k) => songOf(k) === song)
    if (mine.length === 0) continue
    if (song === 'long') await openSong(page, LONG_DEMO, 'Long demo')
    else await openSong(page, PEDAL_DEMO, 'Pedal demo')
    for (const key of mine) if ((await rangeSheet(page, browser, key)) > 0) sheets++
  }
  return sheets
}

for (const group of GROUPS) {
  test(`@visual range ${group.name}`, async ({ page, browser }) => {
    test.setTimeout(3_600_000)
    expect(await runGroup(page, browser, group.keys)).toBe(group.keys.length)
    saveBudgets(group.name)
  })
}

/** 4 values across a setting's range (log when perceptual). */
function four(key: SettingKey): number[] {
  return [...new Set(spread(key, [0, 1 / 3, 2 / 3, 1]))]
}

type PairAxis = { readonly key: SettingKey; readonly values: readonly unknown[] }

async function pairSheet(
  page: Page,
  browser: Parameters<typeof writeSheet>[0],
  name: string,
  rows: PairAxis,
  columns: PairAxis,
  base: Settings,
  motion: { moment: number } | null,
  crop?: Crop,
) {
  expectShown(rows.key, base)
  expectShown(columns.key, base)
  const cells: Cell[] = []
  for (const r of rows.values) {
    for (const c of columns.values) {
      const settings = withValue(withValue(base, rows.key, r), columns.key, c)
      const text = `${rows.key.split('.')[1]} ${String(r)} · ${columns.key.split('.')[1]} ${String(c)}`
      if (motion === null) {
        cells.push({ label: text, png: await frameWith(page, settings, 2, crop) })
      } else {
        const { pngs } = await captureWith(page, settings, 2, [motion.moment], crop)
        cells.push({ label: `${text} · t ${motion.moment} s`, png: pngs[0] as Buffer })
      }
    }
  }
  await writeSheet(
    browser,
    `${OUT}/pairs/${name}.png`,
    `${rows.key} (rows) × ${columns.key} (columns)`,
    cells,
    columns.values.length,
    Math.min(520, crop?.width ?? 520),
  )
  return cells.length
}

test('@visual range pairs: bloom, edges, vignette', async ({ page, browser }) => {
  test.setTimeout(3_600_000)
  await openSong(page, PEDAL_DEMO, 'Pedal demo')
  const axis = (key: SettingKey): PairAxis => ({ key, values: four(key) })
  const bloomLook = { effects: { soundingGlow: true }, lines: { borders: true, octaves: true } }
  expect(
    await pairSheet(
      page,
      browser,
      'bloom-strength-x-threshold',
      axis('render.bloomStrength'),
      axis('render.bloomThreshold'),
      bloomLook,
      null,
    ),
  ).toBe(16)
  await pairSheet(
    page,
    browser,
    'bloom-strength-x-radius',
    axis('render.bloomStrength'),
    axis('render.bloomRadius'),
    bloomLook,
    null,
  )
  await pairSheet(
    page,
    browser,
    'edge-width-x-intensity',
    axis('noteStyle.edgeWidth'),
    axis('noteStyle.edgeIntensity'),
    { noteStyle: { edgeGlow: true } },
    null,
    NOTES_CROP,
  )
  await pairSheet(
    page,
    browser,
    'vignette-x-highway-colour',
    axis('highway.vignette'),
    { key: 'colors.highway', values: ['#05060A', '#0A0F1E', '#2A3350'] },
    {},
    null,
  )
})

test('@visual range pairs: particle count × lifetime', async ({ page, browser }) => {
  test.setTimeout(3_600_000)
  await openSong(page, LONG_DEMO, 'Long demo')
  for (const e of ONSETS) {
    await pairSheet(
      page,
      browser,
      `${e}-count-x-lifetime`,
      { key: `effects.${e}Count` as SettingKey, values: four(`effects.${e}Count` as SettingKey) },
      {
        key: `effects.${e}Lifetime` as SettingKey,
        values: four(`effects.${e}Lifetime` as SettingKey),
      },
      { effects: onsetOnly(e) },
      { moment: 0.5 },
      PARTICLES_CROP,
    )
  }
  expect(
    await pairSheet(
      page,
      browser,
      'sustain-count-x-lifetime',
      { key: 'effects.sustainCount', values: four('effects.sustainCount') },
      { key: 'effects.sustainLifetime', values: four('effects.sustainLifetime') },
      { effects: { ...onsetOnly(null), sustain: 'embers' } },
      { moment: 1.2 },
      PARTICLES_CROP,
    ),
  ).toBe(16)
})
