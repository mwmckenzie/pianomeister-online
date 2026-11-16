// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import { blackLaneLift } from './blackLaneLift'

describe('blackLaneLift', () => {
  const { notes, keyboard } = DEFAULT_SETTINGS

  it('follows the black key height by default', () => {
    expect(blackLaneLift(notes, keyboard)).toBeCloseTo(12 / 23.5, 12)
    expect(blackLaneLift(notes, { ...keyboard, blackHeight: 0.3 })).toBe(0.3)
  })

  it('uses the manual value in manual mode', () => {
    expect(blackLaneLift({ ...notes, blackLiftMode: 'manual', blackLift: 0.7 }, keyboard)).toBe(0.7)
  })
})
