// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mergeSpans } from './mergeSpans'

const s = (startTick: number, endTick: number) => ({ startTick, endTick })

describe('mergeSpans', () => {
  it('merges overlapping and touching spans, keeping separate ones apart', () => {
    expect(mergeSpans([s(500, 900), s(0, 100), s(50, 200), s(200, 300), s(1000, 1100)])).toEqual([
      s(0, 300),
      s(500, 900),
      s(1000, 1100),
    ])
  })

  it('swallows spans contained in others and drops empty ones', () => {
    expect(mergeSpans([s(0, 1000), s(10, 20), s(5, 5)])).toEqual([s(0, 1000)])
    expect(mergeSpans([])).toEqual([])
  })
})
