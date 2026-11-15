// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { loadSettings, SETTINGS_VERSION, storedSettings } from './loadSettings'
import { SETTING_RANGES } from './SETTING_RANGES'

const stored = (settings: unknown, version = SETTINGS_VERSION) => ({ version, settings })

describe('loadSettings', () => {
  it('uses the brief defaults when nothing is stored', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings('garbage')).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.camera.tiltDeg).toBe(45)
    expect(DEFAULT_SETTINGS.highway.lookAheadBeats).toBe(8)
    expect(DEFAULT_SETTINGS.colors.background).toBe('#05070F')
    expect(DEFAULT_SETTINGS.colors.highway).toBe('#0A0F1E')
  })

  it('round-trips stored settings', () => {
    const custom = { ...DEFAULT_SETTINGS, camera: { tiltDeg: 30, distanceOffset: -0.3, pan: 4 } }
    expect(loadSettings(JSON.parse(JSON.stringify(storedSettings(custom))))).toEqual(custom)
  })

  it('merges partial stored values over the defaults', () => {
    const loaded = loadSettings(stored({ camera: { tiltDeg: 60 }, effects: { enabled: false } }))
    expect(loaded.camera).toEqual({ ...DEFAULT_SETTINGS.camera, tiltDeg: 60 })
    expect(loaded.effects.enabled).toBe(false)
    expect(loaded.colors).toEqual(DEFAULT_SETTINGS.colors)
  })

  it('clamps out-of-range numbers', () => {
    const loaded = loadSettings(
      stored({ camera: { tiltDeg: 5, distanceOffset: 9 }, opacity: { lane: -1 } }),
    )
    expect(loaded.camera.tiltDeg).toBe(SETTING_RANGES.camera.tiltDeg[0])
    expect(loaded.camera.distanceOffset).toBe(SETTING_RANGES.camera.distanceOffset[1])
    expect(loaded.opacity.lane).toBe(0)
  })

  it('falls back to the default for wrong types and malformed colours', () => {
    const loaded = loadSettings(
      stored({
        camera: { tiltDeg: '60', pan: Number.NaN },
        colors: { background: 'blue', lane: '#12345', bar: '#a1b2c3' },
        effects: { enabled: 'yes' },
        highway: 'not a section',
      }),
    )
    expect(loaded.camera.tiltDeg).toBe(45)
    expect(loaded.camera.pan).toBe(0)
    expect(loaded.colors.background).toBe('#05070F')
    expect(loaded.colors.lane).toBe(DEFAULT_SETTINGS.colors.lane)
    expect(loaded.colors.bar).toBe('#A1B2C3')
    expect(loaded.effects.enabled).toBe(true)
    expect(loaded.highway).toEqual(DEFAULT_SETTINGS.highway)
  })

  it('ignores unknown keys and sections', () => {
    const loaded = loadSettings(stored({ camera: { zoom: 3 }, extras: { a: 1 } }))
    expect(loaded).toEqual(DEFAULT_SETTINGS)
    expect(Object.keys(loaded)).not.toContain('extras')
    expect(Object.keys(loaded.camera)).not.toContain('zoom')
  })

  it('discards settings stored under another schema version', () => {
    expect(loadSettings(stored({ camera: { tiltDeg: 60 } }, SETTINGS_VERSION + 1))).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(loadSettings({ settings: { camera: { tiltDeg: 60 } } })).toEqual(DEFAULT_SETTINGS)
  })
})
