// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { KeyState } from './KeyState'
import { KeyStates } from './KeyStates'

const PPQ = 480
const span = (midi: number, startTick: number, endTick: number) => ({ midi, startTick, endTick })
const alphaOf = (states: readonly KeyState[], midi: number) =>
  states.find((s) => s.midi === midi)?.alpha

describe('KeyStates', () => {
  it('covers all 88 keys with their pitch-class colour', () => {
    const states = new KeyStates([]).at(0, PPQ, 0.7)
    expect(states).toHaveLength(88)
    expect(states[0]).toMatchObject({ midi: 21, colorIndex: 9, alpha: 0, sounding: false })
  })

  it("reports the sounding note's velocity (the latest onset wins)", () => {
    const keys = new KeyStates([
      { midi: 60, startTick: 0, endTick: 960, velocity: 30 },
      { midi: 60, startTick: 480, endTick: 960, velocity: 110 },
    ])
    expect(keys.at(100, PPQ, 0.7).find((s) => s.midi === 60)?.velocity).toBe(30)
    expect(keys.at(500, PPQ, 0.7).find((s) => s.midi === 60)?.velocity).toBe(110)
    expect(keys.at(960, PPQ, 0.7).find((s) => s.midi === 60)?.velocity).toBe(0)
  })

  it('treats a position a hair before a bar line (float rounding) as on it', () => {
    const keys = new KeyStates([span(60, 0, 3840), span(62, 3840, 4320)])
    const states = keys.at(3840 - 1e-6, PPQ, 0.7)
    expect(states.find((s) => s.midi === 60)?.sounding).toBe(false)
    expect(states.find((s) => s.midi === 62)?.sounding).toBe(true)
  })

  it('is fully lit while a note sounds, and dark after it ends', () => {
    const keys = new KeyStates([span(60, 1000, 1480)])
    expect(alphaOf(keys.at(1000, PPQ, 0.7), 60)).toBe(1)
    expect(alphaOf(keys.at(1479, PPQ, 0.7), 60)).toBe(1)
    expect(alphaOf(keys.at(1480, PPQ, 0.7), 60)).toBe(0)
  })

  it('fades in from 0 to the max approach alpha over the window before an onset', () => {
    const keys = new KeyStates([span(60, 1000, 1480)])
    expect(alphaOf(keys.at(1000 - PPQ - 1, PPQ, 0.7), 60)).toBe(0)
    expect(alphaOf(keys.at(1000 - PPQ, PPQ, 0.7), 60)).toBe(0)
    expect(alphaOf(keys.at(1000 - PPQ / 2, PPQ, 0.7), 60)).toBeCloseTo(0.35, 12)
    expect(alphaOf(keys.at(999, PPQ, 0.7), 60)).toBeCloseTo(0.7 * (1 - 1 / PPQ), 12)
  })

  it('lets a sounding note win over the next note fading in on the same key', () => {
    // Repeated note: the second starts 100 ticks after the first ends, inside the fade window.
    const keys = new KeyStates([span(60, 0, 900), span(60, 1000, 1400)])
    expect(alphaOf(keys.at(800, PPQ, 0.7), 60)).toBe(1)
    expect(alphaOf(keys.at(950, PPQ, 0.7), 60)).toBeCloseTo(0.7 * (1 - 50 / PPQ), 12)
    expect(alphaOf(keys.at(1000, PPQ, 0.7), 60)).toBe(1)
  })

  it('treats each key of a chord independently, and handles overlapping same-pitch notes', () => {
    const keys = new KeyStates([
      span(60, 0, 480),
      span(64, 0, 960),
      span(67, 0, 240),
      span(72, 0, 1000),
      span(72, 100, 200), // starts and ends inside the longer C5
    ])
    const states = keys.at(300, PPQ, 0.7)
    expect([60, 64, 67, 72, 62].map((m) => alphaOf(states, m))).toEqual([1, 1, 0, 1, 0])
  })

  it('shows no fade-in when the fade window is 0', () => {
    expect(alphaOf(new KeyStates([span(60, 100, 200)]).at(99, 0, 0.7), 60)).toBe(0)
  })
})
