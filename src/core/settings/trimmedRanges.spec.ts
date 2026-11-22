// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BUILT_IN_LOOKS } from '../looks/BUILT_IN_LOOKS'
import { readLookValues } from '../looks/readLookValues'
import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { loadSettings, storedSettings } from './loadSettings'
import type { SettingKey } from './SettingKey'
import { settingDefinition } from './settingValues'

/**
 * Milestone 9.1 §B trimmed the slider ranges. Values saved under the old, wider ranges (stored
 * settings, look files, backups) are clamped into the new ones on the way in, like any stored
 * value; no settings version bump is needed for that.
 */
const OLD_EXTREMES: readonly (readonly [SettingKey, number, number])[] = [
  // key, a value the old range allowed, where it lands now
  ['camera.tiltDeg', 20, 25],
  ['opacity.beat', 1, 0.6],
  ['lines.nowWidth', 0.4, 0.3],
  ['notes.sustainCenterTransparency', 1, 0.85],
  ['keys.maxApproachAlpha', 0, 0.1],
  ['names.height', 24, 18],
  ['names.keySize', 8, 9],
  ['pedal.fillOpacity', 1, 0.8],
  ['render.bloomThreshold', 0.9, 0.4],
  ['effects.minScale', 3, 2],
  ['effects.maxScale', 0.2, 0.5],
  ['effects.glitterCount', 3, 2],
  ['effects.explosionCount', 3, 2.5],
  ['effects.pulseAmount', 0, 0.15],
  ['effects.pulseDecayMs', 40, 100],
]

function withValue(key: SettingKey, value: number): Record<string, Record<string, unknown>> {
  const [section, field] = key.split('.') as [string, string]
  const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Record<
    string,
    Record<string, unknown>
  >
  ;(settings[section] as Record<string, unknown>)[field] = value
  return settings
}

function read(settings: object, key: SettingKey): unknown {
  const [section, field] = key.split('.') as [string, string]
  return (settings as Record<string, Record<string, unknown>>)[section]?.[field]
}

describe('trimmed ranges (milestone 9.1 §B)', () => {
  it.each(OLD_EXTREMES)('clamps a stored %s of %d to %d on load', (key, old, now) => {
    const raw = { ...storedSettings(DEFAULT_SETTINGS), settings: withValue(key, old) }
    expect(read(loadSettings(JSON.parse(JSON.stringify(raw))), key)).toBe(now)
  })

  it.each(OLD_EXTREMES)('clamps an imported look %s of %d to %d', (key, old, now) => {
    expect(readLookValues({ [key]: old })[key]).toBe(now)
  })

  it('keeps every built-in look inside the ranges', () => {
    const outside = BUILT_IN_LOOKS.flatMap((look) =>
      Object.entries(look.values).flatMap(([key, value]) => {
        const def = settingDefinition(key as SettingKey)
        if (def.kind !== 'number' || typeof value !== 'number') return []
        return value < def.min || value > def.max ? [`${look.name}: ${key} = ${value}`] : []
      }),
    )
    expect(outside).toEqual([])
  })
})
