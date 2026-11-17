// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatTempoRange } from './formatTempoRange'
import type { SongFacts } from './SongFacts'

const facts = (bpm: number, bpmMin?: number, bpmMax?: number): SongFacts => ({
  durationSeconds: 60,
  durationTicks: 1920,
  ppq: 480,
  bars: 4,
  timeSignatures: ['4/4'],
  bpm,
  ...(bpmMin === undefined ? {} : { bpmMin }),
  ...(bpmMax === undefined ? {} : { bpmMax }),
})

describe('formatTempoRange', () => {
  it('shows a range, or one value when constant (after rounding)', () => {
    expect(formatTempoRange(facts(120, 120, 126))).toBe('120–126 bpm')
    expect(formatTempoRange(facts(126, 126, 126))).toBe('126 bpm')
    expect(formatTempoRange(facts(126, 125.9, 126.2))).toBe('126 bpm')
  })

  it('falls back to the start tempo for facts stored without a range', () => {
    expect(formatTempoRange(facts(100))).toBe('100 bpm')
  })
})
