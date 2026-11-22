// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { charKey } from '../commands/keyBindings'
import { EMPTY_LOOKS } from '../looks/EMPTY_LOOKS'
import { captureLook } from '../looks/lookValues'
import {
  loadDeviceClass,
  loadLooks,
  loadSettings,
  loadShortcuts,
  SETTINGS_VERSION,
  storedSettings,
} from './loadSettings'
import { SETTINGS_REGISTRY as R } from './SETTINGS_REGISTRY'

const stored = (settings: unknown, version = SETTINGS_VERSION) => ({ version, settings })

describe('loadSettings', () => {
  it('uses the brief defaults when nothing is stored', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(loadSettings('garbage')).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.camera.tiltDeg).toBe(45)
    expect(DEFAULT_SETTINGS.highway.lookAheadBeats).toBe(8)
    expect(DEFAULT_SETTINGS.colors.background).toBe('#03050B')
    expect(DEFAULT_SETTINGS.colors.highway).toBe('#070B16')
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
    expect(loaded.camera.tiltDeg).toBe(R['camera.tiltDeg'].min)
    expect(loaded.camera.distanceOffset).toBe(R['camera.distanceOffset'].max)
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
    expect(loaded.colors.background).toBe('#03050B')
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
    expect(loaded.audio).toEqual(DEFAULT_SETTINGS.audio)
    // Saved again, it is a current-version entry that round-trips.
    expect(storedSettings(loaded).version).toBe(SETTINGS_VERSION)
    expect(loadSettings(JSON.parse(JSON.stringify(storedSettings(loaded))))).toEqual(loaded)
  })

  it('applies the keyboard limits to stored values', () => {
    const loaded = loadSettings(
      stored({
        keyboard: { thickness: 0.5, blackHeight: 0.8, pressDepthBlack: 0.8, pressDepthWhite: 0.9 },
      }),
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
    expect(loaded.keyboard.gap).toBe(R['keyboard.gap'].max)
    expect(loaded.keyboard.blackHeight).toBe(0)
    expect(loaded.keyboard.edgeProfile).toBe('chamfer')
    expect(loaded.keyboard.pressDepthWhite).toBe(0.3)
    // blackHeight −1 → 0, so black keys can't be pressed at all (cross-setting limit).
    expect(loaded.keyboard.pressDepthBlack).toBe(0)
    expect(loaded.notes.blackLiftMode).toBe('manual')
    expect(loaded.notes.blackLift).toBe(R['notes.blackLift'].max)
    expect(loaded.notes.headHeight).toBe(R['notes.headHeight'].min)
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

  it('migrates v2 settings: all values kept, audio/practice/appearance get their defaults', () => {
    const v2 = {
      ...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      camera: { tiltDeg: 30, distanceOffset: 0.2, pan: -2 },
      keyboard: { ...DEFAULT_SETTINGS.keyboard, edgeProfile: 'rounded', gap: 0.1 },
      render: { scaleAuto: false, scale: 1.5, maxPixelRatio: 3, antialias: 'smaa' },
    }
    delete v2.audio
    delete v2.practice
    delete v2.appearance
    const loaded = loadSettings(stored(v2, 2))
    expect(loaded.camera).toEqual(v2.camera)
    expect(loaded.keyboard).toEqual(v2.keyboard)
    expect(loaded.render).toMatchObject(v2.render)
    expect(loaded.audio).toEqual(DEFAULT_SETTINGS.audio)
    expect(loaded.practice).toEqual(DEFAULT_SETTINGS.practice)
    expect(loaded.appearance).toEqual(DEFAULT_SETTINGS.appearance)
  })

  it('validates the new v3 sections', () => {
    const loaded = loadSettings(
      stored({
        audio: { master: 3, rightAudio: 'solo', leftAudio: 'loud', metronomeMode: 'preRoll' },
        practice: { preRollBeats: 40, preRollMode: 'quiet', tempoStep: 0 },
        appearance: { primary: '#ffb38a', secondary: 'orange', blur: -5, motion: 'reduced' },
      }),
    )
    expect(loaded.audio.master).toBe(1)
    expect(loaded.audio.rightAudio).toBe('solo')
    expect(loaded.audio.leftAudio).toBe('on')
    expect(loaded.audio.metronomeMode).toBe('preRoll')
    expect(loaded.practice).toEqual({ tempoStep: 1, preRollBeats: 16, preRollMode: 'quiet' })
    expect(loaded.appearance.primary).toBe('#FFB38A')
    expect(loaded.appearance.secondary).toBe('#7EE0C3')
    expect(loaded.appearance.blur).toBe(0)
    expect(loaded.appearance.motion).toBe('reduced')
  })

  it('migrates v3 "Hide controls when idle" to the switch plus seconds', () => {
    const v3 = (hideControls: string) =>
      loadSettings({ version: 3, settings: { appearance: { hideControls, motion: 'full' } } })
    expect(v3('off').appearance).toMatchObject({ hideControls: false, hideControlsAfter: 3 })
    expect(v3('2').appearance).toMatchObject({ hideControls: true, hideControlsAfter: 2 })
    expect(v3('10').appearance).toMatchObject({
      hideControls: true,
      hideControlsAfter: 10,
      motion: 'full',
    })
    // Never set: the defaults (on, after 3 s); the new tempo step is 5%.
    const fresh = loadSettings({ version: 3, settings: {} })
    expect(fresh.appearance).toMatchObject({ hideControls: true, hideControlsAfter: 3 })
    expect(fresh.practice.tempoStep).toBe(5)
  })

  it('keeps the idle delay in 0.5–10 s', () => {
    const loaded = loadSettings({
      version: 4,
      settings: { appearance: { hideControls: false, hideControlsAfter: 40 } },
    })
    expect(loaded.appearance).toMatchObject({ hideControls: false, hideControlsAfter: 10 })
  })

  it('migrates v4 to v5 with no shortcut overrides, and round-trips them from v5', () => {
    const v4 = { version: 4, settings: { camera: { tiltDeg: 50 } } }
    expect(loadSettings(v4).camera.tiltDeg).toBe(50)
    expect(loadShortcuts(v4)).toEqual({})
    const overrides = { playPause: [charKey('k')], stop: [] }
    const stored = JSON.parse(JSON.stringify(storedSettings(loadSettings(v4), overrides)))
    expect(stored.version).toBe(SETTINGS_VERSION)
    expect(loadShortcuts(stored)).toEqual(overrides)
    expect(loadShortcuts({ ...stored, version: SETTINGS_VERSION + 1 })).toEqual({})
    expect(loadShortcuts(null)).toEqual({})
  })

  it('migrates v5 to v6: the pedal band becomes the pedal cage fill, shortcuts are kept', () => {
    const overrides = { playPause: [charKey('k')] }
    const v5 = {
      version: 5,
      settings: {
        colors: { background: '#010203', pedal: '#112233' },
        opacity: { lane: 0.5, pedal: 0.4 },
        effects: { enabled: false },
      },
      shortcuts: overrides,
    }
    const loaded = loadSettings(v5)
    expect(loaded.pedal).toEqual({
      ...DEFAULT_SETTINGS.pedal,
      fillColor: '#112233',
      fillOpacity: 0.4,
    })
    expect(loaded.colors.background).toBe('#010203')
    expect(loaded.opacity.lane).toBe(0.5)
    expect(loaded.effects.enabled).toBe(false)
    expect(loaded.lines).toEqual(DEFAULT_SETTINGS.lines)
    expect(loadShortcuts(v5)).toEqual(overrides)
    expect(loadLooks(v5)).toEqual(EMPTY_LOOKS)
  })

  it('uses the tablet defaults for values a tablet has stored nothing for', () => {
    expect(loadSettings(null, 'tablet').render).toMatchObject({
      quality: 'low',
      bloomResolution: 'quarter',
      particleBudget: 1024,
      shaderDetail: 'low',
    })
    const partial = loadSettings(stored({ render: { quality: 'high' } }), 'tablet')
    expect(partial.render.quality).toBe('high')
    expect(partial.render.particleBudget).toBe(1024)
    expect(loadSettings(null).render.quality).toBe('medium')
  })

  it('keeps the device class the defaults were chosen for', () => {
    const tablet = JSON.parse(
      JSON.stringify(storedSettings(DEFAULT_SETTINGS, {}, EMPTY_LOOKS, 'tablet')),
    )
    expect(loadDeviceClass(tablet, 'desktop')).toBe('tablet')
    expect(loadDeviceClass({ ...tablet, deviceClass: 'phone' }, 'desktop')).toBe('desktop')
    expect(loadDeviceClass({ version: 5, settings: {} }, 'tablet')).toBe('tablet')
    expect(loadDeviceClass(null, 'desktop')).toBe('desktop')
  })

  it('round-trips the picked look and looks still waiting to move to the database', () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look-1', 'Neon night')
    const state = { active: 'look-1', saved: [look] }
    const raw = JSON.parse(JSON.stringify(storedSettings(DEFAULT_SETTINGS, {}, state)))
    const loaded = loadLooks(raw)
    expect(loaded.active).toBe('look-1')
    expect(loaded.saved.map(({ id, name, values }) => ({ id, name, values }))).toEqual([
      { id: look.id, name: look.name, values: look.values },
    ])
    expect(loadLooks({ ...raw, version: SETTINGS_VERSION + 1 })).toEqual(EMPTY_LOOKS)
  })

  it('migrates v6 to v7: old Neon becomes Outline, the shared stripes move into each use', () => {
    const v6 = stored(
      {
        noteStyle: {
          headFill: 'neon',
          sustainFill: 'stripes',
          stripeWidth: 0.6,
          stripeDrift: true,
        },
        pedal: { fill: 'neon' },
      },
      6,
    )
    const s = loadSettings(v6)
    expect(s.noteStyle.headFill).toBe('outline')
    expect(s.noteStyle.sustainFill).toBe('stripes')
    expect(s.pedal.fill).toBe('outline')
    for (const use of ['head', 'sustain'] as const) {
      expect(s.noteStyle[`${use}StripeWidth`]).toBe(0.6)
      expect(s.noteStyle[`${use}StripeDrift`]).toBe(true)
    }
    expect(s.pedal.stripeWidth).toBe(0.6)
    expect(s.pedal.stripeDrift).toBe(true)
    // In v7, Neon is the new fill and stays Neon.
    expect(loadSettings(stored({ noteStyle: { headFill: 'neon' } })).noteStyle.headFill).toBe(
      'neon',
    )
  })

  it('migrates v7 to v8: Glass becomes Crystal, the round-1 Smoke candidate becomes Smoke', () => {
    const v7 = stored(
      {
        noteStyle: { headFill: 'glass', sustainFill: 'smokeRound1' },
        pedal: { fill: 'glass' },
      },
      7,
    )
    const s = loadSettings(v7)
    expect(s.noteStyle.headFill).toBe('crystal')
    expect(s.noteStyle.sustainFill).toBe('smoke')
    expect(s.pedal.fill).toBe('crystal')
    // Other fills are kept.
    const kept = loadSettings(
      stored({ noteStyle: { headFill: 'bubbles', sustainFill: 'neon' } }, 7),
    )
    expect(kept.noteStyle.headFill).toBe('bubbles')
    expect(kept.noteStyle.sustainFill).toBe('neon')
  })

  it('migrates saved looks with Glass to Crystal', () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look-1', 'Old glass')
    const values = {
      ...look.values,
      'noteStyle.headFill': 'glass',
      'noteStyle.sustainFill': 'glass',
      'pedal.fill': 'glass',
    }
    for (const version of [6, 7]) {
      const raw = { version, settings: {}, looks: { active: null, saved: [{ ...look, values }] } }
      const [migrated] = loadLooks(raw).saved
      expect(migrated?.values['noteStyle.headFill']).toBe('crystal')
      expect(migrated?.values['noteStyle.sustainFill']).toBe('crystal')
      expect(migrated?.values['pedal.fill']).toBe('crystal')
    }
  })

  it('keeps the pedal its new, wider stripes when the old shared width was the default', () => {
    const s = loadSettings(stored({ noteStyle: { stripeWidth: 0.35 } }, 6))
    expect(s.noteStyle.headStripeWidth).toBe(0.35)
    expect(s.pedal.stripeWidth).toBe(R['pedal.stripeWidth'].default)
    expect(R['pedal.stripeWidth'].default).toBeGreaterThan(0.35)
  })

  it('migrates saved looks stored by v6 the same way', () => {
    const look = captureLook(DEFAULT_SETTINGS, 'look-1', 'Old neon')
    const values = {
      ...look.values,
      'noteStyle.headFill': 'neon',
      'noteStyle.stripeWidth': 0.8,
    }
    const raw = { version: 6, settings: {}, looks: { active: null, saved: [{ ...look, values }] } }
    const [migrated] = loadLooks(raw).saved
    expect(migrated?.values['noteStyle.headFill']).toBe('outline')
    expect(migrated?.values['noteStyle.headStripeWidth']).toBe(0.8)
    expect(migrated?.values['pedal.stripeWidth']).toBe(0.8)
  })
})
