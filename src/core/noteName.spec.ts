// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { noteName } from './noteName'

describe('noteName', () => {
  it.each([
    [60, 'C4'],
    [61, 'C#4'],
    [21, 'A0'],
    [108, 'C8'],
    [0, 'C-1'],
    [127, 'G9'],
  ])('names MIDI note %i as %s', (midi, name) => {
    expect(noteName(midi)).toBe(name)
  })

  it('rejects notes outside 0–127', () => {
    expect(() => noteName(128)).toThrow(RangeError)
  })
})
