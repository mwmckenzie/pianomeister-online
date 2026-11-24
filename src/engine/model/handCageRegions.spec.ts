// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { HandCage } from '@/core/cages/HandCage'

import { handCageRegions } from './handCageRegions'

const cage = (bar: number, low: number, carried = false, deck?: number) => ({
  barIndex: bar,
  startTick: bar * 100,
  endTick: bar * 100 + 100,
  low,
  high: low + 7,
  carried,
  ...(deck === undefined ? {} : { deck }),
})

describe('handCageRegions', () => {
  it('gives the played and carried pieces of one region its whole span', () => {
    const regions = handCageRegions([
      cage(1, 60),
      cage(2, 60, true),
      cage(3, 60, true),
      cage(4, 40),
    ])
    expect(regions.map((r) => [r.startTick, r.endTick, r.spanStart, r.spanEnd, r.carried])).toEqual(
      [
        [100, 200, 100, 400, false],
        [200, 400, 100, 400, true],
        [400, 500, 400, 500, false],
      ],
    )
    expect(regions.map((r) => [r.openStart, r.openEnd])).toEqual([
      [false, true],
      [true, false],
      [false, false],
    ])
  })

  it('never joins cages of different playlist songs, and keeps their deck', () => {
    const cages: (HandCage & { deck?: number })[] = [cage(1, 60, false, 0), cage(2, 60, false, 1)]
    const regions = handCageRegions(cages)
    expect(regions).toHaveLength(2)
    expect(regions.map((r) => r.deck)).toEqual([0, 1])
  })
})
