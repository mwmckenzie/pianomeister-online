// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { THEME_PRESETS } from './THEME_PRESETS'
import { contrast, DARK_TEXT, LIGHT_TEXT, relativeLuminance, textColorOn } from './textColorOn'

describe('textColorOn', () => {
  it('uses dark text on every (light) preset primary, readable at WCAG AA', () => {
    const ratios = THEME_PRESETS.map((p) => ({
      name: p.name,
      text: textColorOn(p.primary),
      readable: contrast(relativeLuminance(p.primary), relativeLuminance(DARK_TEXT)) >= 4.5,
    }))
    expect(ratios).toEqual(
      THEME_PRESETS.map((p) => ({ name: p.name, text: DARK_TEXT, readable: true })),
    )
  })

  it('switches to light text on dark or saturated colours', () => {
    expect(textColorOn('#000000')).toBe(LIGHT_TEXT)
    expect(textColorOn('#1A3D8F')).toBe(LIGHT_TEXT)
    expect(textColorOn('#FFFFFF')).toBe(DARK_TEXT)
    expect(textColorOn('#FFFF00')).toBe(DARK_TEXT)
  })

  it('computes WCAG luminance', () => {
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 6)
    expect(relativeLuminance('#000000')).toBe(0)
    expect(contrast(1, 0)).toBeCloseTo(21, 6)
  })
})
