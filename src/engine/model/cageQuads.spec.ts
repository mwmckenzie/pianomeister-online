// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { cageQuads } from './cageQuads'
import { keyLayout } from './keyLayout'

const full = { startTick: 0, endTick: 480, lowMidi: null, highMidi: null }

describe('cageQuads', () => {
  it('spans the whole highway when no keys are given', () => {
    expect(cageQuads([full])).toEqual([
      { x0: 0, x1: 52, startTick: 0, endTick: 480, openStart: false, openEnd: false },
    ])
  })

  it('spans from the lowest key lane to the highest one', () => {
    // C4 (60) … E4 (64): white C4 left edge to white E4 right edge.
    const [q] = cageQuads([{ ...full, lowMidi: 60, highMidi: 64 }])
    const c4 = keyLayout()[60 - 21]!
    const e4 = keyLayout()[64 - 21]!
    expect(q?.x0).toBe(c4.x)
    expect(q?.x1).toBe(e4.x + e4.width)
    expect(q!.x1 - q!.x0).toBe(3)
  })

  it('uses a black key lane at the ends of the range', () => {
    const [q] = cageQuads([{ ...full, lowMidi: 61, highMidi: 61 }])
    const cs4 = keyLayout()[61 - 21]!
    expect(q).toMatchObject({ x0: cs4.x, x1: cs4.x + cs4.width })
  })

  it('clamps to the keyboard and drops empty or reversed regions', () => {
    expect(cageQuads([{ ...full, lowMidi: 0, highMidi: 200 }])[0]).toMatchObject({ x0: 0, x1: 52 })
    expect(cageQuads([{ ...full, endTick: 0 }])).toEqual([])
    expect(cageQuads([{ ...full, lowMidi: 70, highMidi: 60 }])).toEqual([])
  })

  it('keeps open ends for joined regions', () => {
    const [q] = cageQuads([{ ...full, openStart: true, openEnd: true }])
    expect(q).toMatchObject({ openStart: true, openEnd: true })
  })
})
