// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_PROFILE } from './DEFAULT_PROFILE'
import { PROFILE_COLORS } from './PROFILE_COLORS'
import { profileInitial } from './profileInitial'

describe('profileInitial', () => {
  it('takes the first letter or digit, upper-cased', () => {
    expect(profileInitial('me')).toBe('M')
    expect(profileInitial('  ånna')).toBe('Å')
    expect(profileInitial('"Bob"')).toBe('B')
    expect(profileInitial('2nd')).toBe('2')
  })

  it('falls back to a question mark', () => {
    expect(profileInitial('')).toBe('?')
    expect(profileInitial('!!')).toBe('?')
  })
})

describe('profile colours', () => {
  it('are the five preset primaries, and the default profile uses one', () => {
    expect(PROFILE_COLORS).toHaveLength(5)
    expect(PROFILE_COLORS).toContain(DEFAULT_PROFILE.color)
  })
})
