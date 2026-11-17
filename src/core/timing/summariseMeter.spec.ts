// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BarMap } from './BarMap'
import { summariseMeter } from './summariseMeter'

const PPQ = 480
const ts = (tick: number, numerator: number, denominator = 4) => ({
  tick,
  numerator,
  denominator,
})
const map = (events: ReturnType<typeof ts>[], durationTicks: number) =>
  BarMap.fromSong({ ppq: PPQ, durationTicks, timeSignatureEvents: events }, null)

describe('summariseMeter', () => {
  it('has no changes for one meter', () => {
    expect(summariseMeter(map([ts(0, 3)], 3 * PPQ * 8))).toEqual({
      main: '3/4',
      changes: 0,
      runs: [{ bar: 1, meter: '3/4' }],
    })
  })

  it('picks the meter covering the most bars and lists every change', () => {
    // 2 bars of 4/4, 6 bars of 3/4, 1 bar of 4/4.
    const a = 2 * 4 * PPQ
    const b = a + 6 * 3 * PPQ
    const summary = summariseMeter(map([ts(0, 4), ts(a, 3), ts(b, 4)], b + 4 * PPQ))
    expect(summary.main).toBe('3/4')
    expect(summary.changes).toBe(2)
    expect(summary.runs).toEqual([
      { bar: 1, meter: '4/4' },
      { bar: 3, meter: '3/4' },
      { bar: 9, meter: '4/4' },
    ])
  })

  it('keeps the earlier meter on a tie', () => {
    const a = 2 * 4 * PPQ
    expect(summariseMeter(map([ts(0, 4), ts(a, 3)], a + 2 * 3 * PPQ)).main).toBe('4/4')
  })

  it('collapses repeated events of the same meter', () => {
    expect(summariseMeter(map([ts(0, 3), ts(3 * PPQ * 2, 3)], 3 * PPQ * 4)).changes).toBe(0)
  })
})
