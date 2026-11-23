// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { BarMap } from '../timing/BarMap'
import { TempoMap } from '../timing/TempoMap'
import { loopRepeatCount, loopSongTick, MAX_LOOP_REPEATS, outsideLoop } from './loopRepeat'
import { loopWindowFor } from './loopWindowFor'
import { preRollWindowFor } from './preRollWindowFor'

const PPQ = 480
const BAR = 4 * PPQ
const barMap = BarMap.fromSong({ ppq: PPQ, durationTicks: 16 * BAR, timeSignatureEvents: [] }, null)
const tempoMap = new TempoMap(PPQ, [])

describe('loopWindowFor', () => {
  it('is null without a loop', () => {
    expect(loopWindowFor(null, 2, barMap, tempoMap)).toBeNull()
  })

  it('spans the bars; without pre-roll each iteration starts at the loop start', () => {
    expect(loopWindowFor({ startBar: 3, endBar: 4 }, 0, barMap, tempoMap)).toEqual({
      startTick: 2 * BAR,
      endTick: 4 * BAR,
      preStartTick: 2 * BAR,
      periodTicks: 2 * BAR,
    })
  })

  it('starts each iteration at the pre-roll, as the transport plays it', () => {
    const w = loopWindowFor({ startBar: 3, endBar: 4 }, 2, barMap, tempoMap)
    expect(w?.preStartTick).toBeCloseTo(2 * BAR - 2 * PPQ, 6)
    expect(w?.periodTicks).toBeCloseTo(2 * BAR + 2 * PPQ, 6)
    // The same count-in as Transport.windowFor.
    const window = preRollWindowFor(barMap, tempoMap, 2 * BAR, 2)
    expect(tempoMap.secondsToTick(window?.startSec ?? 0)).toBeCloseTo(w?.preStartTick ?? 0, 6)
  })

  it('reaches before the song for a loop at bar 1 (the highway runs empty there)', () => {
    const w = loopWindowFor({ startBar: 1, endBar: 1 }, 4, barMap, tempoMap)
    expect(w?.preStartTick).toBeCloseTo(-BAR, 6)
    expect(w?.periodTicks).toBeCloseTo(2 * BAR, 6)
  })

  it('spaces the count-in at the loop start’s tempo, across a tempo change', () => {
    // 120 bpm, then 60 bpm from bar 3: each count-in beat lasts a second.
    const slow = new TempoMap(PPQ, [{ tick: 2 * BAR, microsPerQuarter: 1_000_000 }])
    const w = loopWindowFor({ startBar: 3, endBar: 3 }, 2, barMap, slow)
    // Two seconds before bar 3 are four beats of the music before it, at 120 bpm.
    expect(w?.preStartTick).toBeCloseTo(2 * BAR - 4 * PPQ, 6)
  })
})

const W = {
  startTick: 2 * BAR,
  endTick: 3 * BAR,
  preStartTick: 2 * BAR - PPQ,
  periodTicks: BAR + PPQ,
}

describe('loopRepeatCount', () => {
  it('repeats as far as the highway reaches, so a short loop shows several times', () => {
    expect(loopRepeatCount(W, 2 * BAR, 0.5 * BAR)).toBe(0)
    expect(loopRepeatCount(W, 2 * BAR, BAR + 1)).toBe(1)
    expect(loopRepeatCount(W, 2 * BAR, 4 * BAR)).toBe(Math.ceil((3 * BAR) / (BAR + PPQ)))
  })

  it('needs none while the playhead is outside the iteration', () => {
    expect(loopRepeatCount(W, 0, 8 * BAR)).toBe(0)
    expect(loopRepeatCount(W, 3 * BAR, 8 * BAR)).toBe(0)
    // In the count-in it does.
    expect(loopRepeatCount(W, 2 * BAR - PPQ, 4 * BAR)).toBeGreaterThan(0)
  })

  it('is capped for very short loops', () => {
    const tiny = { startTick: 0, endTick: 10, preStartTick: 0, periodTicks: 10 }
    expect(loopRepeatCount(tiny, 0, 1e6)).toBe(MAX_LOOP_REPEATS)
  })
})

describe('loopSongTick and outsideLoop', () => {
  it('maps each period beyond the end back onto the iteration', () => {
    expect(loopSongTick(W, 2.5 * BAR)).toBe(2.5 * BAR)
    expect(loopSongTick(W, 3 * BAR)).toBe(2 * BAR - PPQ)
    expect(loopSongTick(W, 3 * BAR + PPQ)).toBe(2 * BAR)
    expect(loopSongTick(W, 3 * BAR + W.periodTicks + PPQ)).toBe(2 * BAR)
  })

  it('treats the pre-roll as outside: only [start, end) is the practice section', () => {
    expect(outsideLoop(W, 2 * BAR - 1)).toBe(true)
    expect(outsideLoop(W, 2 * BAR)).toBe(false)
    expect(outsideLoop(W, 3 * BAR - 1)).toBe(false)
    expect(outsideLoop(W, 3 * BAR)).toBe(true)
  })
})
