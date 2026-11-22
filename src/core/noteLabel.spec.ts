// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { noteLabel } from './noteLabel'

const sharpsOnC = { octave: 'c', accidentals: 'sharps' } as const

describe('noteLabel', () => {
  it('writes the octave on C only by default', () => {
    expect(noteLabel(60, sharpsOnC)).toBe('C4')
    expect(noteLabel(62, sharpsOnC)).toBe('D')
    expect(noteLabel(21, sharpsOnC)).toBe('A')
    expect(noteLabel(108, sharpsOnC)).toBe('C8')
  })

  it('writes the octave on every note on request', () => {
    expect(noteLabel(21, { ...sharpsOnC, octave: 'all' })).toBe('A0')
    expect(noteLabel(71, { ...sharpsOnC, octave: 'all' })).toBe('B4')
  })

  it('spells black keys with sharps or flats', () => {
    expect(noteLabel(61, sharpsOnC)).toBe('C♯')
    expect(noteLabel(61, { ...sharpsOnC, accidentals: 'flats' })).toBe('D♭')
    expect(noteLabel(70, { octave: 'all', accidentals: 'flats' })).toBe('B♭4')
    expect(noteLabel(66, { octave: 'all', accidentals: 'sharps' })).toBe('F♯4')
  })

  it('keeps the octave with the letter across B/C (B3 → C4)', () => {
    expect(noteLabel(59, { ...sharpsOnC, octave: 'all' })).toBe('B3')
    expect(noteLabel(60, { ...sharpsOnC, octave: 'all' })).toBe('C4')
  })

  it('rejects notes outside 0–127', () => {
    expect(() => noteLabel(128, sharpsOnC)).toThrow(RangeError)
    expect(() => noteLabel(-1, sharpsOnC)).toThrow(RangeError)
  })
})
