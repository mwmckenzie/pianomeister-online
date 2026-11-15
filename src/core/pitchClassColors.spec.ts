// @vitest-environment node
// Runs in Node to prove core/ has no DOM dependency.
import { describe, expect, it } from 'vitest'

import { PITCH_CLASS_COLORS, pitchClassColor } from './pitchClassColors'

describe('PITCH_CLASS_COLORS', () => {
  it('matches the palette in docs/brief.md, in pitch-class order', () => {
    expect(PITCH_CLASS_COLORS.map((c) => `${c.name} ${c.hex}`)).toEqual([
      'C #FF0000',
      'C# #A80000',
      'D #FFE500',
      'D# #A19000',
      'E #00C2FF',
      'F #FF9D00',
      'F# #D97500',
      'G #1CFF00',
      'G# #13AC00',
      'A #9500FF',
      'A# #5E00AB',
      'B #FF00D5',
    ])
  })
})

describe('pitchClassColor', () => {
  it.each([
    [60, 'C', '#FF0000'],
    [61, 'C#', '#A80000'],
    [108, 'C', '#FF0000'],
    [21, 'A', '#9500FF'],
    [0, 'C', '#FF0000'],
    [127, 'G', '#1CFF00'],
  ])('maps MIDI note %i to %s', (midiNote, name, hex) => {
    expect(pitchClassColor(midiNote)).toEqual({ name, hex })
  })

  it.each([-1, 128, 60.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws RangeError for %d',
    (midiNote) => {
      expect(() => pitchClassColor(midiNote)).toThrow(RangeError)
    },
  )
})
