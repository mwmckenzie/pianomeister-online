// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { restoreValues } from '../settings/settingGroups'
import { withSetting } from '../settings/settingValues'
import { BUILT_IN_LOOKS } from './BUILT_IN_LOOKS'
import { LOOK_KEYS } from './LOOK_KEYS'
import {
  activeLook,
  allLooks,
  applyLook,
  captureLook,
  isLookModified,
  nextLookName,
} from './lookValues'

const classic = BUILT_IN_LOOKS[0]!

describe('LOOK_KEYS', () => {
  it('holds appearance, not camera, keyboard, look-ahead or render cost', () => {
    expect(LOOK_KEYS).toContain('lines.nowGlow')
    expect(LOOK_KEYS).toContain('colors.background')
    expect(LOOK_KEYS).toContain('render.bloomStrength')
    expect(LOOK_KEYS).toContain('pedal.fillColor')
    for (const key of [
      'camera.tiltDeg',
      'keyboard.thickness',
      'highway.lookAheadBeats',
      'notes.blackLift',
      'keys.fadeBeats',
      'render.quality',
      'render.particleBudget',
      'render.antialias',
      'audio.master',
    ] as const) {
      expect(LOOK_KEYS).not.toContain(key)
    }
  })
})

describe('Classic', () => {
  it('has a value for every look key', () => {
    expect(Object.keys(classic.values).sort()).toEqual([...LOOK_KEYS].sort())
  })

  it('is the milestone 8 look: its colours, no glow, no new effects', () => {
    expect(classic.values).toMatchObject({
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

describe('looks', () => {
  it('apply sets every look value and Undo restores the previous ones', () => {
    const custom = withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 60)
    const { settings, previous } = applyLook(custom, classic)
    expect(settings.colors.background).toBe('#05070F')
    expect(settings.camera.tiltDeg).toBe(60)
    expect(isLookModified(settings, classic)).toBe(false)
    expect(restoreValues(settings, previous)).toEqual(custom)
  })

  it('a change afterwards counts as modified; a change outside the look does not', () => {
    const { settings } = applyLook(DEFAULT_SETTINGS, classic)
    expect(isLookModified(withSetting(settings, 'lines.nowGlow', 1), classic)).toBe(true)
    expect(isLookModified(withSetting(settings, 'camera.pan', 4), classic)).toBe(false)
    // Within half a slider step still matches (as for defaults).
    expect(isLookModified(withSetting(settings, 'opacity.lane', 0.354), classic)).toBe(false)
  })

  it('capture saves the current look values', () => {
    const tweaked = withSetting(DEFAULT_SETTINGS, 'lines.nowStyle', 'neon')
    const look = captureLook(tweaked, 'a', 'Mine')
    expect(look.values['lines.nowStyle']).toBe('neon')
    expect(Object.keys(look.values)).toHaveLength(LOOK_KEYS.length)
    expect(isLookModified(tweaked, look)).toBe(false)
  })

  it('lists built-in looks first and finds the active one', () => {
    const mine = captureLook(DEFAULT_SETTINGS, 'a', 'Mine')
    const state = { active: 'a', saved: [mine] }
    expect(allLooks(state).map((l) => l.name)).toEqual(['Classic', 'Mine'])
    expect(activeLook(state)).toBe(mine)
    expect(activeLook({ active: 'gone', saved: [] })).toBeNull()
  })

  it('suggests an unused name', () => {
    const state = { active: null, saved: [captureLook(DEFAULT_SETTINGS, 'a', 'My look')] }
    expect(nextLookName({ active: null, saved: [] })).toBe('My look')
    expect(nextLookName(state)).toBe('My look 2')
  })
})
