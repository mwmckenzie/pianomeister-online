// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { hiddenByOverlap } from './hiddenByOverlap'

const rect = (x: number, y: number, width = 20, height = 10) => ({ x, y, width, height })

describe('hiddenByOverlap', () => {
  it('keeps labels that do not overlap', () => {
    expect(hiddenByOverlap([rect(0, 0), rect(30, 0), rect(0, 20)])).toEqual([false, false, false])
  })

  it('hides the farther of two overlapping labels', () => {
    expect(hiddenByOverlap([rect(0, 0), rect(10, 5)])).toEqual([false, true])
  })

  it('compares only with kept labels, so a hidden one hides nothing', () => {
    // b overlaps a (hidden); c overlaps b but not a, so c stays.
    expect(hiddenByOverlap([rect(0, 0), rect(15, 0), rect(30, 0)])).toEqual([false, true, false])
  })

  it('counts the clearance gap as overlap', () => {
    expect(hiddenByOverlap([rect(0, 0), rect(21, 0)])).toEqual([false, false])
    expect(hiddenByOverlap([rect(0, 0), rect(21, 0)], 2)).toEqual([false, true])
  })
})
