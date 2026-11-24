// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { channelHandOf } from '../hands/channelHandOf'
import type { HandAssignment } from '../hands/HandAssignment'
import type { Note } from '../song/Note'
import type { TimeSignatureEvent } from '../song/TimeSignatureEvent'
import { BarMap } from '../timing/BarMap'
import { computeHandCages } from './computeHandCages'
import { handCageRuns } from './handCageRuns'

const PPQ = 480
const BAR = 4 * PPQ

const note = (midi: number, startTick: number, endTick: number, channel = 0): Note => ({
  id: 'n',
  track: 0,
  midi,
  channel,
  startTick,
  endTick,
  velocity: 80,
})

const bars = (count: number, events: readonly TimeSignatureEvent[] = []) =>
  BarMap.fromSong(
    {
      ppq: PPQ,
      durationTicks: count * BAR,
      timeSignatureEvents: events.length > 0 ? events : [{ tick: 0, numerator: 4, denominator: 4 }],
    },
    null,
  )

const RIGHT_ONLY: HandAssignment = { right: [0], left: [] }
const cages = (notes: readonly Note[], count = 4, assignment = RIGHT_ONLY) =>
  computeHandCages(notes, bars(count), channelHandOf(assignment))
const range = (c: { low: number; high: number } | undefined) => [c?.low, c?.high]

describe('computeHandCages', () => {
  it('takes the exact range of a bar spanning five semitones or more', () => {
    const [bar] = cages([note(60, 0, 100), note(67, 200, 300)]).right
    expect(bar).toEqual({
      barIndex: 1,
      startTick: 0,
      endTick: BAR,
      low: 60,
      high: 67,
      carried: false,
    })
  })

  it('widens a narrow first bar around its centre, high first', () => {
    expect(range(cages([note(60, 0, 100)]).right[0])).toEqual([58, 63])
  })

  it('widens up when the hand moved down, down when it moved up', () => {
    const down = cages([note(70, 0, 100), note(80, 0, 100), note(60, BAR, BAR + 100)]).right
    expect(range(down[1])).toEqual([60, 65])
    const up = cages([note(40, 0, 100), note(50, 0, 100), note(60, BAR, BAR + 100)]).right
    expect(range(up[1])).toEqual([55, 60])
  })

  it('compares with the previous cage after its own widening', () => {
    // Bar 1: 60 alone widens to 58–63 (mean 60.5); bar 2: 61 alone (mean 61) moved up: widen down.
    const r = cages([note(60, 0, 100), note(61, BAR, BAR + 100)]).right
    expect(range(r[1])).toEqual([56, 61])
  })

  it('carries the previous range through rest bars, with each rest bar’s own timing', () => {
    const r = cages([note(60, 0, 100), note(67, 0, 100), note(62, 3 * BAR, 3 * BAR + 100)]).right
    expect(r.map((c) => [c.barIndex, c.low, c.high, c.carried])).toEqual([
      [1, 60, 67, false],
      [2, 60, 67, true],
      [3, 60, 67, true],
      // 62 alone, below the carried 60–67 (the hand moved down): widened up.
      [4, 62, 67, false],
    ])
    expect([r[1]?.startTick, r[1]?.endTick]).toEqual([BAR, 2 * BAR])
  })

  it('makes no cage before the first note or after the last', () => {
    const r = cages([note(60, 2 * BAR, 2 * BAR + 100), note(67, 2 * BAR, 2 * BAR + 100)], 8).right
    expect(r.map((c) => c.barIndex)).toEqual([3])
  })

  it('counts a note in every bar it sounds in, but not a bar it ends exactly at', () => {
    const held = cages([note(60, 0, BAR + 10), note(72, BAR, BAR + 100)]).right
    expect(range(held[1])).toEqual([60, 72])
    const ends = cages([note(60, 0, BAR), note(72, BAR, BAR + 100)]).right
    // Only 72 sounds in bar 2, above 58–63 (the hand moved up): widened down.
    expect(range(ends[1])).toEqual([67, 72])
  })

  it('counts a zero-length note as one tick long', () => {
    expect(cages([note(64, 0, 0)]).right.map((c) => c.barIndex)).toEqual([1])
  })

  it('clamps to the piano and widens on the free side at either end', () => {
    expect(range(cages([note(21, 0, 100)]).right[0])).toEqual([21, 26])
    expect(range(cages([note(108, 0, 100)]).right[0])).toEqual([103, 108])
    expect(range(cages([note(10, 0, 100)]).right[0])).toEqual([21, 26])
  })

  it('follows the real bar boundaries across a time-signature change', () => {
    const map = bars(4, [
      { tick: 0, numerator: 4, denominator: 4 },
      { tick: BAR, numerator: 3, denominator: 4 },
    ])
    const notes = [note(60, 0, 100), note(60, BAR + 3 * PPQ, BAR + 3 * PPQ + 100)]
    const r = computeHandCages(notes, map, channelHandOf(RIGHT_ONLY)).right
    expect(r.map((c) => [c.barIndex, c.startTick, c.endTick, c.carried])).toEqual([
      [1, 0, BAR, false],
      [2, BAR, BAR + 3 * PPQ, true],
      [3, BAR + 3 * PPQ, BAR + 6 * PPQ, false],
    ])
  })

  it('merges the channels mapped to one hand, and follows a change of assignment', () => {
    const notes = [note(60, 0, 100, 0), note(72, 0, 100, 2)]
    expect(range(cages(notes, 1, { right: [0, 2], left: [] }).right[0])).toEqual([60, 72])
    const moved = cages(notes, 1, { right: [0], left: [2] })
    expect(range(moved.right[0])).toEqual([58, 63])
    expect(range(moved.left[0])).toEqual([70, 75])
  })

  it('makes no cage for a Hidden channel, and an empty list for a hand without notes', () => {
    const r = cages([note(60, 0, 100, 0), note(40, 0, 100, 5)], 1, { right: [0], left: [] })
    expect(r.right).toHaveLength(1)
    expect(r.left).toEqual([])
  })

  it('reads hands only through handOf', () => {
    const notes = [note(60, 0, 100, 0), note(48, 0, 100, 0)]
    // Per note (milestone 10.5): same channel, different hands.
    const r = computeHandCages(notes, bars(1), (n) => (n.midi >= 60 ? 'right' : 'left'))
    expect(range(r.right[0])).toEqual([58, 63])
    expect(range(r.left[0])).toEqual([46, 51])
  })
})

describe('handCageRuns', () => {
  it('joins equal consecutive cages, splits on a change of keys', () => {
    const r = cages([
      note(60, 0, 100),
      note(67, 0, 100),
      note(60, BAR, BAR + 100),
      note(67, BAR, BAR + 100),
      note(40, 2 * BAR, 2 * BAR + 100),
      note(47, 2 * BAR, 2 * BAR + 100),
    ]).right
    expect(handCageRuns(r)).toEqual([
      {
        startTick: 0,
        endTick: 2 * BAR,
        low: 60,
        high: 67,
        carried: false,
        openStart: false,
        openEnd: false,
      },
      {
        startTick: 2 * BAR,
        endTick: 3 * BAR,
        low: 40,
        high: 47,
        carried: false,
        openStart: false,
        openEnd: false,
      },
    ])
  })

  it('keeps played and carried bars of one region as pieces with open ends where they meet', () => {
    const r = cages([
      note(60, 0, 100),
      note(67, 0, 100),
      note(60, 3 * BAR, 3 * BAR + 100),
      note(67, 3 * BAR, 3 * BAR + 100),
    ]).right
    expect(
      handCageRuns(r).map((p) => [p.startTick, p.endTick, p.carried, p.openStart, p.openEnd]),
    ).toEqual([
      [0, BAR, false, false, true],
      [BAR, 3 * BAR, true, true, true],
      [3 * BAR, 4 * BAR, false, true, false],
    ])
  })
})
