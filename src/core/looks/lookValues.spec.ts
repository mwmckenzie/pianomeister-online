// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS, defaultSettings } from '../settings/DEFAULT_SETTINGS'
import { restoreValues } from '../settings/settingGroups'
import { SETTING_KEYS } from '../settings/SETTING_KEYS'
import { readSetting, settingDefinition, withSetting } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { COST_KEYS } from './COST_KEYS'
import type { Look } from './Look'
import { LOOK_KEYS } from './LOOK_KEYS'
import {
  activeLook,
  allLooks,
  applyLook,
  captureLook,
  isLookModified,
  lookSettings,
  nextLookName,
  sameLookValues,
} from './lookValues'

const classic = BUILT_IN_LOOKS[0]!
const NOW = '2026-11-22T10:00:00.000Z'

describe('LOOK_KEYS', () => {
  it('holds every playfield sidebar setting except device cost', () => {
    for (const key of [
      'camera.tiltDeg',
      'keyboard.thickness',
      'highway.lookAheadBeats',
      'notes.blackHeadHeight',
      'keys.fadeBeats',
      'lines.nowGlow',
      'colors.background',
      'render.bloomStrength',
      'pedal.fillColor',
    ] as const) {
      expect(LOOK_KEYS).toContain(key)
    }
    for (const key of COST_KEYS) expect(LOOK_KEYS).not.toContain(key)
    expect(LOOK_KEYS).not.toContain('audio.master')
    const sidebar = SETTING_KEYS.filter((key) => settingDefinition(key).home.area === 'sidebar')
    expect(LOOK_KEYS).toHaveLength(sidebar.length - COST_KEYS.size)
  })

  it('cost keys are the quality preset, what it sets, and resolution', () => {
    expect([...COST_KEYS].sort()).toEqual(
      [
        'render.antialias',
        'render.bloomResolution',
        'render.maxPixelRatio',
        'render.particleBudget',
        'render.quality',
        'render.scale',
        'render.scaleAuto',
        'render.shaderDetail',
      ].sort(),
    )
  })
})

describe('Classic', () => {
  it('pins every look key, so a default change never moves it', () => {
    expect(Object.keys(classic.values).sort()).toEqual([...LOOK_KEYS].sort())
  })

  it('is the milestone 8 look: its colours, camera, no glow, no new effects', () => {
    expect(classic.values).toMatchObject({
      'camera.tiltDeg': 45,
      'highway.lookAheadBeats': 8,
      'colors.background': '#05070F',
      'colors.highway': '#0A0F1E',
      'highway.vignette': 0,
      'lines.nowStyle': 'thin',
      'lines.nowGlow': 0,
      'lines.borders': false,
      'noteStyle.edgeGlow': false,
      'effects.pulse': false,
      'effects.sustain': 'glow',
      'pedal.fillColor': '#4A5468',
      'pedal.fillOpacity': 0.22,
      'render.bloomStrength': 0,
    })
  })
})

describe('applying a look', () => {
  it('sets every playfield setting, camera included, and Undo restores them', () => {
    const custom = withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 60)
    const { settings, previous } = applyLook(custom, classic)
    expect(settings.colors.background).toBe('#05070F')
    expect(settings.camera.tiltDeg).toBe(45)
    expect(isLookModified(settings, classic)).toBe(false)
    expect(restoreValues(settings, previous)).toEqual(custom)
  })

  it('is self-contained: a key the look lacks takes the default, whatever was set before', () => {
    const partial: Look = { ...classic, id: 'p', builtIn: false, values: { 'lines.nowGlow': 2 } }
    const a = lookSettings(withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 70), partial)
    const b = lookSettings(withSetting(DEFAULT_SETTINGS, 'lines.borders', true), partial)
    for (const key of LOOK_KEYS) expect(readSetting(a, key)).toEqual(readSetting(b, key))
    expect(a.lines.nowGlow).toBe(2)
    expect(a.camera.tiltDeg).toBe(DEFAULT_SETTINGS.camera.tiltDeg)
    expect(isLookModified(a, partial)).toBe(false)
  })

  it('never stores or applies device cost', () => {
    const tablet = defaultSettings('tablet')
    const custom = withSetting(withSetting(tablet, 'render.scale', 1.5), 'render.maxPixelRatio', 3)
    // A hand-written look carrying cost values still can't change them.
    const greedy: Look = {
      ...classic,
      values: { ...classic.values, 'render.quality': 'high', 'render.particleBudget': 4096 },
    }
    const out = lookSettings(custom, greedy, 'tablet')
    for (const key of COST_KEYS) expect(readSetting(out, key)).toEqual(readSetting(custom, key))
    const captured = captureLook(out, 'c', 'C')
    for (const key of COST_KEYS) expect(key in captured.values).toBe(false)
  })

  it('stays pure: the base settings are untouched (a temporary overlay later)', () => {
    const base = structuredClone(DEFAULT_SETTINGS)
    lookSettings(base, classic)
    expect(base).toEqual(DEFAULT_SETTINGS)
  })

  it('a change afterwards counts as modified, camera included, cost not', () => {
    const { settings } = applyLook(DEFAULT_SETTINGS, classic)
    expect(isLookModified(withSetting(settings, 'lines.nowGlow', 1), classic)).toBe(true)
    expect(isLookModified(withSetting(settings, 'camera.pan', 4), classic)).toBe(true)
    expect(isLookModified(withSetting(settings, 'render.particleBudget', 512), classic)).toBe(false)
    // Within half a slider step still matches (as for defaults).
    expect(isLookModified(withSetting(settings, 'opacity.lane', 0.354), classic)).toBe(false)
  })
})

describe('capturing and listing looks', () => {
  it('capture saves every look key and no cost key', () => {
    const tweaked = withSetting(DEFAULT_SETTINGS, 'lines.nowStyle', 'neon')
    const look = captureLook(tweaked, 'a', 'Mine', NOW)
    expect(look).toMatchObject({ id: 'a', name: 'Mine', createdAt: NOW, updatedAt: NOW })
    expect(look.values['lines.nowStyle']).toBe('neon')
    expect(Object.keys(look.values).sort()).toEqual([...LOOK_KEYS].sort())
    expect(isLookModified(tweaked, look)).toBe(false)
  })

  it('compares looks by the picture they give', () => {
    const a = captureLook(DEFAULT_SETTINGS, 'a', 'A')
    expect(sameLookValues(a, { ...a, id: 'b', name: 'B', values: {} })).toBe(true)
    const panned = captureLook(withSetting(DEFAULT_SETTINGS, 'camera.pan', 2), 'a', 'A')
    expect(sameLookValues(a, panned)).toBe(false)
  })

  it('lists built-in looks first and finds the active one', () => {
    const mine = captureLook(DEFAULT_SETTINGS, 'a', 'Mine')
    const state = { active: 'a', saved: [mine] }
    const names = allLooks(state).map((l) => l.name)
    expect(names[0]).toBe('Classic')
    expect(names[names.length - 1]).toBe('Mine')
    expect(names).toHaveLength(15)
    expect(activeLook(state)).toBe(mine)
    expect(activeLook({ active: 'gone', saved: [] })).toBeNull()
  })

  it('suggests an unused name', () => {
    const state = { active: null, saved: [captureLook(DEFAULT_SETTINGS, 'a', 'My look')] }
    expect(nextLookName({ active: null, saved: [] })).toBe('My look')
    expect(nextLookName(state)).toBe('My look 2')
  })
})
