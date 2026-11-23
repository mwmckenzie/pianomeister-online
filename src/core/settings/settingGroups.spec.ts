// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { changedCount, resetGroup, restoreValues } from './settingGroups'
import { isDefaultValue, withSetting } from './settingValues'

describe('settings groups, reset and undo', () => {
  it('counts changed settings per section, tab and sidebar', () => {
    let s = withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 60)
    s = withSetting(s, 'keyboard.gap', 0.1)
    s = withSetting(s, 'audio.leftVolume', 0.6)
    expect(changedCount(s, { kind: 'section', id: 'camera' })).toBe(1)
    expect(changedCount(s, { kind: 'section', id: 'notes' })).toBe(0)
    expect(changedCount(s, { kind: 'sidebar' })).toBe(2)
    expect(changedCount(s, { kind: 'tab', id: 'audio' })).toBe(1)
    expect(changedCount(DEFAULT_SETTINGS, { kind: 'sidebar' })).toBe(0)
  })

  it('resets a section to its defaults and leaves other sections alone', () => {
    let s = withSetting(DEFAULT_SETTINGS, 'camera.tiltDeg', 60)
    s = withSetting(s, 'camera.pan', 3)
    s = withSetting(s, 'keyboard.gap', 0.1)
    const { settings, previous } = resetGroup(s, { kind: 'section', id: 'camera' })
    expect(settings.camera).toEqual(DEFAULT_SETTINGS.camera)
    expect(settings.keyboard.gap).toBe(0.1)
    expect(previous.get('camera.tiltDeg')).toBe(60)
    expect(previous.get('camera.pan')).toBe(3)
    expect(previous.has('keyboard.gap')).toBe(false)
  })

  it('undoes a reset, including keyboard values that depend on each other', () => {
    // Lowered black keys with a matching depth: restoring must not clamp the depth against
    // the default height (or the height against a default thickness) on the way.
    let s = withSetting(DEFAULT_SETTINGS, 'keyboard.thickness', 1)
    s = withSetting(s, 'keyboard.blackHeight', 0.9)
    s = withSetting(s, 'keyboard.pressDepthBlack', 0.8)
    const { settings: reset, previous } = resetGroup(s, { kind: 'sidebar' })
    expect(reset.keyboard).toEqual(DEFAULT_SETTINGS.keyboard)
    const restored = restoreValues(reset, previous)
    expect(restored.keyboard).toEqual(s.keyboard)
    expect(restored).toEqual(s)
  })

  it('resets a whole tab', () => {
    let s = withSetting(DEFAULT_SETTINGS, 'appearance.primary', '#FFB38A')
    s = withSetting(s, 'appearance.blur', 0)
    s = withSetting(s, 'audio.master', 0.3)
    const { settings } = resetGroup(s, { kind: 'tab', id: 'appearance' })
    expect(settings.appearance).toEqual(DEFAULT_SETTINGS.appearance)
    expect(settings.audio.master).toBe(0.3)
  })

  it('treats values within half a step of the default as default', () => {
    // Black key height default 12/23.5 ≈ 0.5106 is off the 0.05 slider grid.
    expect(isDefaultValue('keyboard.blackHeight', 12 / 23.5)).toBe(true)
    expect(isDefaultValue('keyboard.blackHeight', 0.5)).toBe(true)
    expect(isDefaultValue('keyboard.blackHeight', 0.55)).toBe(false)
    expect(isDefaultValue('appearance.primary', '#8ab4ff')).toBe(true)
    expect(isDefaultValue('keyboard.edgeProfile', 'rounded')).toBe(false)
    expect(isDefaultValue('effects.enabled', true)).toBe(true)
  })

  it('applies the keyboard limits when one value changes', () => {
    const s = withSetting(DEFAULT_SETTINGS, 'keyboard.blackHeight', 0.2)
    expect(s.keyboard.pressDepthBlack).toBeCloseTo(0.12, 12)
    expect(DEFAULT_SETTINGS.keyboard.blackHeight).toBeCloseTo(12 / 23.5, 12)
  })
})
