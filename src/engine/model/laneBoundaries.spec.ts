// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { laneBoundaries } from './laneBoundaries'

describe('laneBoundaries', () => {
  const all = laneBoundaries()

  it('has one boundary per white-key edge, the outer two being borders', () => {
    expect(all).toHaveLength(53)
    expect(all[0]).toEqual({ x: 0, kind: 'border' })
    expect(all[52]).toEqual({ x: 52, kind: 'border' })
    expect(all.filter((b) => b.kind === 'border')).toHaveLength(2)
  })

  it('marks every B/C boundary as an octave line', () => {
    // A0 B0 | C1 …: the first B/C boundary is after the second white key.
    expect(all[2]).toEqual({ x: 2, kind: 'octave' })
    expect(all.filter((b) => b.kind === 'octave').map((b) => b.x)).toEqual([
      2, 9, 16, 23, 30, 37, 44, 51,
    ])
  })

  it('marks every E/F boundary', () => {
    // C1 D1 E1 | F1: three whites after the first C.
    expect(all[5]).toEqual({ x: 5, kind: 'ef' })
    expect(all.filter((b) => b.kind === 'ef')).toHaveLength(7)
  })
})
