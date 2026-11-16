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

  it('discards settings from an unknown newer version or without a version', () => {
    expect(loadSettings(stored({ camera: { tiltDeg: 60 } }, SETTINGS_VERSION + 1))).toEqual(
      DEFAULT_SETTINGS,
    )
    expect(loadSettings({ settings: { camera: { tiltDeg: 60 } } })).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(stored({ camera: { tiltDeg: 60 } }, 0))).toEqual(DEFAULT_SETTINGS)
  })

  it('migrates v1 settings: stored values are kept, new keys get their defaults', () => {
    // A complete v1 entry as milestone 4 stored it.
    const v1 = {
      camera: { tiltDeg: 60, distanceOffset: -0.2, pan: 3 },
      highway: { lookAheadBeats: 12 },
      keys: { fadeBeats: 2, maxApproachAlpha: 0.5 },
      notes: { sustainCenterTransparency: 0.1, sustainEdgeTransparency: 0.9 },
      colors: { ...DEFAULT_SETTINGS.colors, lane: '#112233' },
      opacity: { lane: 0.5, bar: 0.6, beat: 0.12, pedal: 0.22 },
      effects: { enabled: false },
    }
    const loaded = loadSettings(stored(v1, 1))
    expect(loaded.camera).toEqual(v1.camera)
    expect(loaded.highway).toEqual({ ...DEFAULT_SETTINGS.highway, lookAheadBeats: 12 })
    expect(loaded.keys).toEqual(v1.keys)
    expect(loaded.notes).toEqual({ ...DEFAULT_SETTINGS.notes, ...v1.notes })
    expect(loaded.colors.lane).toBe('#112233')
    expect(loaded.effects).toEqual({ ...DEFAULT_SETTINGS.effects, enabled: false })
    expect(loaded.keyboard).toEqual(DEFAULT_SETTINGS.keyboard)
    expect(loaded.render).toEqual(DEFAULT_SETTINGS.render)
    // Saved again, it is a v2 entry that round-trips.
    expect(storedSettings(loaded).version).toBe(2)
    expect(loadSettings(JSON.parse(JSON.stringify(storedSettings(loaded))))).toEqual(loaded)
  })

  it('applies the keyboard limits to stored values', () => {
    const loaded = loadSettings(
      stored({ keyboard: { thickness: 0.5, blackHeight: 0.8, pressDepthBlack: 0.8, pressDepthWhite: 0.9 } }),
    )
    expect(loaded.keyboard.blackHeight).toBe(0.5)
    expect(loaded.keyboard.pressDepthBlack).toBeCloseTo(0.42, 12)
    expect(loaded.keyboard.pressDepthWhite).toBe(0.5)
  })

  it('clamps new numeric settings and accepts only listed choices', () => {
    const loaded = loadSettings(
      stored({
        keyboard: { gap: 1, blackHeight: -1, edgeProfile: 'ROUNDED', pressDepthWhite: 0.3 },
        notes: { blackLiftMode: 'manual', blackLift: 5, headHeight: 0 },
        render: { antialias: 'taa', scale: 9, maxPixelRatio: 0 },
      }),
    )
    expect(loaded.keyboard.gap).toBe(SETTING_RANGES.keyboard.gap[1])
    expect(loaded.keyboard.blackHeight).toBe(0)
    expect(loaded.keyboard.edgeProfile).toBe('chamfer')
    expect(loaded.keyboard.pressDepthWhite).toBe(0.3)
    // blackHeight −1 → 0, so black keys can't be pressed at all (cross-setting limit).
    expect(loaded.keyboard.pressDepthBlack).toBe(0)
    expect(loaded.notes.blackLiftMode).toBe('manual')
    expect(loaded.notes.blackLift).toBe(SETTING_RANGES.notes.blackLift[1])
    expect(loaded.notes.headHeight).toBe(SETTING_RANGES.notes.headHeight[0])
    expect(loaded.render.antialias).toBe('msaa')
    expect(loaded.render.scale).toBe(2)
    expect(loaded.render.maxPixelRatio).toBe(1)
  })

  it('defaults to real grand-piano proportions and the m5 visual defaults', () => {
    expect(DEFAULT_SETTINGS.keyboard).toMatchObject({
      thickness: 0.6,
      gap: 0.06,
      blackLengthRatio: 0.63,
      edgeProfile: 'chamfer',
      edgeSize: 0.04,
      animate: true,
      pressDepthWhite: 0.22,
      pressDepthBlack: 0.3,
      pivotOffsetWhite: 0,
    })
    // Twice the black key's visible length (63% of 150 mm) behind it.
    expect(DEFAULT_SETTINGS.keyboard.pivotOffsetBlack).toBeCloseTo((2 * 0.63 * 150) / 23.5, 12)
    expect(DEFAULT_SETTINGS.keyboard.blackHeight).toBeCloseTo(12 / 23.5, 10)
    expect(DEFAULT_SETTINGS.notes.blackLift).toBeCloseTo(12 / 23.5, 10)
    expect(DEFAULT_SETTINGS.notes).toMatchObject({
      heads3d: true,
      headHeight: 0.35,
      headRounded: true,
      blackLiftMode: 'keys',
      contactShadow: true,
      shadowStrength: 0.45,
    })
    expect(DEFAULT_SETTINGS.highway).toMatchObject({
      blackLaneShading: true,
      blackLaneShadingStrength: 0.22,
    })
    expect(DEFAULT_SETTINGS.effects).toMatchObject({ minScale: 0.6, maxScale: 1.7 })
  })
})
