// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { applyQualityPreset, isQualityModified } from './applyQualityPreset'
import { DEFAULT_SETTINGS, defaultSettings } from './DEFAULT_SETTINGS'
import { QUALITY_PRESETS } from './QUALITY_PRESETS'
import { resetGroup } from './settingGroups'
import { isDefaultValue, withSetting } from './settingValues'

describe('quality presets', () => {
  it('Off is the pre-milestone-9 pipeline: no bloom, 512 particles', () => {
    expect(QUALITY_PRESETS.off).toEqual({
      bloomResolution: 'off',
      particleBudget: 512,
      shaderDetail: 'minimal',
    })
  })

  it('choosing a preset sets its cost settings and nothing else', () => {
    const render = applyQualityPreset(DEFAULT_SETTINGS.render, 'high')
    expect(render).toEqual({
      ...DEFAULT_SETTINGS.render,
      quality: 'high',
      bloomResolution: 'full',
      particleBudget: 4096,
      shaderDetail: 'high',
    })
    expect(isQualityModified(render)).toBe(false)
  })

  it('a cost change afterwards counts as modified', () => {
    const tweaked = withSetting(DEFAULT_SETTINGS, 'render.particleBudget', 3072)
    expect(tweaked.render.quality).toBe('medium')
    expect(isQualityModified(tweaked.render)).toBe(true)
    expect(isQualityModified(DEFAULT_SETTINGS.render)).toBe(false)
  })

  it('setting the preset key (row, reset icon) applies the preset', () => {
    const low = withSetting(DEFAULT_SETTINGS, 'render.quality', 'low')
    expect(low.render).toMatchObject(QUALITY_PRESETS.low)
    const back = withSetting(low, 'render.quality', 'medium')
    expect(back.render).toEqual(DEFAULT_SETTINGS.render)
  })

  it('the defaults match their preset on every device', () => {
    expect(isQualityModified(defaultSettings('desktop').render)).toBe(false)
    expect(isQualityModified(defaultSettings('tablet').render)).toBe(false)
    expect(defaultSettings('tablet').render.quality).toBe('low')
  })

  it('reset and "changed" use the device defaults', () => {
    const tablet = defaultSettings('tablet')
    expect(isDefaultValue('render.quality', 'low', 'tablet')).toBe(true)
    expect(isDefaultValue('render.quality', 'low', 'desktop')).toBe(false)
    const high = withSetting(tablet, 'render.quality', 'high')
    expect(resetGroup(high, { kind: 'section', id: 'render' }, 'tablet').settings.render).toEqual(
      tablet.render,
    )
  })
})
