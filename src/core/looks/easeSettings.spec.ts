// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../settings/DEFAULT_SETTINGS'
import { withSetting } from '../settings/settingValues'
import { easeSettings, eases } from './easeSettings'

describe('easeSettings (a look across a playlist seam)', () => {
  const from = withSetting(
    withSetting(
      withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 30),
      'colors.background',
      '#000000',
    ),
    'noteStyle.headFill',
    'solid',
  )
  const to = withSetting(
    withSetting(
      withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 50),
      'colors.background',
      '#FF0000',
    ),
    'noteStyle.headFill',
    'neon',
  )

  it('eases numbers and colours, switches the rest at the midpoint', () => {
    const quarter = easeSettings(from, to, 0.25)
    expect(quarter.camera.tiltDeg).toBe(35)
    expect(quarter.colors.background).toBe('#400000')
    expect(quarter.noteStyle.headFill).toBe('solid')
    const late = easeSettings(from, to, 0.75)
    expect(late.noteStyle.headFill).toBe('neon')
    expect(easeSettings(from, to, 1)).toBe(to)
  })

  it('never eases the keyboard geometry, fills or toggles', () => {
    expect(eases('keyboard.thickness', 0.6)).toBe(false)
    expect(eases('noteStyle.headFill', 'solid')).toBe(false)
    expect(eases('lines.borders', true)).toBe(false)
    expect(eases('highway.lookAheadBeats', 10)).toBe(true)
    expect(eases('lines.bordersGlow', 0.3)).toBe(true)
    expect(eases('render.bloomStrength', 0.5)).toBe(true)
  })
})
