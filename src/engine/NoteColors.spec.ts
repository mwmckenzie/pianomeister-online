import { describe, expect, it } from 'vitest'

import { PITCH_CLASS_COLORS } from '@/core/pitchClassColors'

import { NoteColors } from './NoteColors'
import { srgb } from './srgb'

describe('NoteColors', () => {
  it('starts on the default palette', () => {
    const colors = new NoteColors()
    expect(colors.at(0).equals(srgb(PITCH_CLASS_COLORS[0].hex))).toBe(true)
    expect(colors.version).toBe(0)
  })

  it('updates the same Color objects in place and bumps the version once per change', () => {
    const colors = new NoteColors()
    const c = colors.at(4)
    const mono = Array.from({ length: 12 }, () => '#6FA8FF')
    expect(colors.set(mono)).toBe(true)
    expect(colors.at(4)).toBe(c)
    expect(c.equals(srgb('#6FA8FF'))).toBe(true)
    expect(colors.version).toBe(1)
    expect(colors.set(mono)).toBe(false)
    expect(colors.version).toBe(1)
  })

  it('wraps pitch classes', () => {
    const colors = new NoteColors()
    expect(colors.at(13)).toBe(colors.at(1))
  })
})
