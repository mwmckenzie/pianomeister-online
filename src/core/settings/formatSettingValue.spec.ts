// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from './DEFAULT_SETTINGS'
import { formatSettingValue } from './formatSettingValue'
import { settingMax } from './settingMax'
import { SETTINGS_REGISTRY as R } from './SETTINGS_REGISTRY'
import { withSetting } from './settingValues'

describe('formatSettingValue — whole percent and seconds', () => {
  it('shows the number itself', () => {
    const base = {
      kind: 'number',
      label: 'x',
      default: 0,
      home: { area: 'sidebar', section: 'camera' },
      min: 0,
      max: 10,
      step: 1,
    } as const
    expect(formatSettingValue({ ...base, unit: 'wholePercent', digits: 0 }, 5)).toBe('5%')
    expect(formatSettingValue({ ...base, unit: 'seconds', digits: 1 }, 2.5)).toBe('2.5 s')
    expect(formatSettingValue({ ...base, unit: 'seconds', digits: 1 }, 3)).toBe('3 s')
  })
})

describe('formatSettingValue', () => {
  it('shows keyboard lengths in mm (×23.5)', () => {
    expect(formatSettingValue(R['keyboard.blackHeight'], 12 / 23.5)).toBe('12 mm')
    expect(formatSettingValue(R['keyboard.thickness'], 0.6)).toBe('14 mm')
    expect(formatSettingValue(R['keyboard.gap'], 0.06)).toBe('1.4 mm')
    expect(formatSettingValue(R['keyboard.pressDepthWhite'], 0.22)).toBe('5.2 mm')
    expect(formatSettingValue(R['keyboard.edgeSize'], 0.04)).toBe('0.9 mm')
    expect(formatSettingValue(R['keyboard.gap'], 0)).toBe('0 mm')
  })

  it('shows other units', () => {
    expect(formatSettingValue(R['camera.tiltDeg'], 45)).toBe('45°')
    expect(formatSettingValue(R['audio.master'], 0.8)).toBe('80%')
    expect(formatSettingValue(R['highway.lookAheadBeats'], 8)).toBe('8 beats')
    expect(formatSettingValue(R['keys.fadeBeats'], 1)).toBe('1 beat')
    expect(formatSettingValue(R['keys.fadeBeats'], 1.5)).toBe('1.5 beats')
    expect(formatSettingValue(R['effects.maxScale'], 1.7)).toBe('1.70×')
    expect(formatSettingValue(R['appearance.blur'], 26)).toBe('26 px')
    expect(formatSettingValue(R['camera.pan'], -0)).toBe('0.0')
  })
})

describe('settingMax', () => {
  it('lowers keyboard maxima with the other keyboard settings', () => {
    expect(settingMax('keyboard.blackHeight', DEFAULT_SETTINGS)).toBe(0.6)
    expect(settingMax('keyboard.pressDepthWhite', DEFAULT_SETTINGS)).toBe(0.6)
    expect(settingMax('keyboard.pressDepthBlack', DEFAULT_SETTINGS)).toBeCloseTo(
      12 / 23.5 - 0.08,
      8,
    )
    const low = withSetting(DEFAULT_SETTINGS, 'keyboard.blackHeight', 0.25)
    expect(settingMax('keyboard.pressDepthBlack', low)).toBe(0.17)
    expect(settingMax('camera.tiltDeg', DEFAULT_SETTINGS)).toBe(85)
  })
})
