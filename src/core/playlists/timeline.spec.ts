// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { HandNote } from '../hands/HandNote'
import { TempoMap } from '../timing/TempoMap'
import { buildTimeline } from './buildTimeline'
import { GAP_AT_ZERO_SEC } from './GAP_AT_ZERO_SEC'
import { RELEASE_SEC } from './RELEASE_SEC'
import { songEndSec } from './songEndSec'
import { songStartTimes } from './songStartTimes'
import type { TimelineSource } from './TimelineSource'

const note = (start: number, end: number, midi = 60): HandNote => ({
  midi,
  startTick: start,
  endTick: end,
  soundEndTick: end,
  velocity: 80,
  channel: 0,
  hand: 'right',
})

/** A song: `ppq`, one tempo (bpm), a meter, notes in ticks. */
function source(ppq: number, bpm: number, notes: HandNote[], meter = [4, 4]): TimelineSource {
  const tempoEvents = [{ tick: 0, microsPerQuarter: 60e6 / bpm }]
  return {
    song: {
      ppq,
      tempoEvents,
      timeSignatureEvents: [{ tick: 0, numerator: meter[0] ?? 4, denominator: meter[1] ?? 4 }],
      pedalIntervals: [],
    },
    tempoMap: new TempoMap(ppq, tempoEvents),
    notes,
  }
}

describe('songEndSec', () => {
  it('is the last release, not the file length', () => {
    const s = source(480, 120, [note(0, 480), note(960, 1920)])
    // 1920 ticks at 120 bpm = 2 s, plus the release.
    expect(songEndSec(s.notes, s.tempoMap)).toBeCloseTo(2 + RELEASE_SEC, 9)
    expect(songEndSec([], s.tempoMap)).toBe(0)
  })
})

describe('songStartTimes', () => {
  it('starts each song `crossfade` seconds before the previous one ends', () => {
    expect(songStartTimes([60, 90, 30], 2)).toEqual([0, 58, 146])
  })

  it('leaves a short gap at crossfade 0', () => {
    expect(songStartTimes([60, 90], 0)).toEqual([0, 60 + GAP_AT_ZERO_SEC])
  })

  it('never overlaps more than half of either song', () => {
    expect(songStartTimes([4, 90], 8)).toEqual([0, 2])
    expect(songStartTimes([90, 6], 8)).toEqual([0, 87])
  })
})

describe('buildTimeline', () => {
  // A: 120 bpm, 480 ppq, 4/4, notes to 4 s. B: 60 bpm, 960 ppq, 3/4.
  const a = source(480, 120, [note(0, 480), note(3840, 3840 + 480, 62)])
  const b = source(960, 60, [note(0, 960, 64), note(1920, 2880, 65)], [3, 4])
  const aEnd = songEndSec(a.notes, a.tempoMap)
  const [, bStart] = songStartTimes([aEnd, songEndSec(b.notes, b.tempoMap)], 2)
  const t = buildTimeline([
    { source: a, startSec: 0, deck: 0 },
    { source: b, startSec: bStart ?? 0, deck: 1 },
  ])
  const sec = (tick: number) => t.song.tempoMap.tickToSeconds(tick)

  it('keeps every note at its exact time, whatever each song’s PPQ and tempo', () => {
    const times = t.notes.map((n) => [n.midi, Number(sec(n.startTick).toFixed(6)), n.deck])
    expect(times).toEqual([
      [60, 0, 0],
      [64, Number((bStart ?? 0).toFixed(6)), 1],
      [62, 4, 0],
      [65, Number(((bStart ?? 0) + 2).toFixed(6)), 1],
    ])
  })

  it('takes the next song’s tempo from its start', () => {
    expect(t.song.tempoMap.bpmAt(t.song.tempoMap.secondsToTick(1))).toBeCloseTo(120, 6)
    expect(t.song.tempoMap.bpmAt(t.song.tempoMap.secondsToTick((bStart ?? 0) + 0.5))).toBeCloseTo(
      60,
      6,
    )
  })

  it('restarts bars at the next song, in its own meter', () => {
    const bTick = t.segments[1]?.startTick ?? 0
    const at = t.song.barMap.tickToPosition(bTick)
    expect(at.beat).toBe(1)
    expect(t.song.barMap.ticksPerBeat(at.bar)).toBe(960)
    expect(t.song.barMap.barEndTick(at.bar) - t.song.barMap.barStartTick(at.bar)).toBe(3 * 960)
  })

  it('places each song’s hand cages with its notes, carrying the song’s deck', () => {
    const cage = (start: number, end: number) => ({
      barIndex: 1,
      startTick: start,
      endTick: end,
      low: 55,
      high: 62,
      carried: false,
    })
    // Song 1: PPQ 480 at 120 bpm (a bar = 2 s); song 2: PPQ 96 at 60 bpm, starting at 10 s.
    const first = {
      ...source(480, 120, [note(0, 480)]),
      handCages: { right: [cage(0, 1920)], left: [] },
    }
    const second = {
      ...source(96, 60, [note(0, 96)]),
      handCages: { right: [], left: [cage(96, 480)] },
    }
    const t = buildTimeline([
      { source: first, startSec: 0, deck: 0 },
      { source: second, startSec: 10, deck: 1 },
    ])
    const sec = (tick: number) => t.song.tempoMap.tickToSeconds(tick)
    const [right] = t.handCages.right
    expect([sec(right?.startTick ?? -1), sec(right?.endTick ?? -1), right?.deck]).toEqual([0, 2, 0])
    const [left] = t.handCages.left
    expect(sec(left?.startTick ?? -1)).toBeCloseTo(11, 9)
    expect(sec(left?.endTick ?? -1)).toBeCloseTo(15, 9)
    expect(left?.deck).toBe(1)
  })

  it('describes each song’s span, and ends at the last release', () => {
    expect(t.segments.map((s) => s.deck)).toEqual([0, 1])
    expect(t.segments[0]?.endSec).toBeCloseTo(aEnd, 9)
    expect(sec(t.song.endTick)).toBeCloseTo(t.segments[1]?.endSec ?? 0, 6)
  })
})
