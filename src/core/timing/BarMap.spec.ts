// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import { readFixture } from '../testing/readFixture'
import { synthFixtures } from '../testing/synthFixtures'
import { BarMap } from './BarMap'

const songFrom = (bytes: Uint8Array) => importMidi(bytes, { fileName: 'x.mid' })

describe('BarMap — file meter', () => {
  it('gives the Minuet 64 bars of 3/4, ignoring the repeated meta at bar 17', async () => {
    const map = BarMap.fromSong(await songFrom(readFixture('minuet-in-g.mid')), null)
    expect(map.barCount).toBe(64)
    expect(map.hasBarZero).toBe(false)
    expect(map.firstBar).toBe(1)
    expect(map.barStartTick(17)).toBe(23040)
    expect(map.beatsPerBar(17)).toBe(3)
    expect(map.barEndTick(64)).toBe(92160)
    expect(map.tickToPosition(23040)).toEqual({ bar: 17, beat: 1, beatFraction: 0 })
  })

  it('places the Canon right-hand entry at bar 5 beat 1 and ends at bar 102', async () => {
    const song = await songFrom(readFixture('canon-in-d.mid'))
    const map = BarMap.fromSong(song, null)
    const firstRight = song.notes.find((n) => n.channel === 0)
    expect(map.tickToPosition(firstRight?.startTick ?? -1)).toEqual({
      bar: 5,
      beat: 1,
      beatFraction: 0,
    })
    expect(map.barStartTick(101)).toBe(192000)
    expect(map.barCount).toBe(102)
  })

  it('defaults to 4/4 when the file has no time signature', async () => {
    const map = BarMap.fromSong(await songFrom(synthFixtures.noMeta()), null)
    expect(map.beatsPerBar(1)).toBe(4)
    expect(map.barStartTick(2)).toBe(1920)
    expect(map.barCount).toBe(2)
  })

  it('handles 4/4 → 3/4 → 4/4', async () => {
    const map = BarMap.fromSong(await songFrom(synthFixtures.meterChanges()), null)
    expect([1, 2, 3, 4, 5, 6, 7].map((b) => map.barStartTick(b))).toEqual([
      0, 1920, 3840, 5280, 6720, 8640, 10560,
    ])
    expect([1, 2, 3, 4, 5, 6].map((b) => map.beatsPerBar(b))).toEqual([4, 4, 3, 3, 4, 4])
    expect(map.barCount).toBe(6)
    expect(map.tickToPosition(5280 + 960)).toEqual({ bar: 4, beat: 3, beatFraction: 0 })
    expect(map.tickToPosition(6720 - 240)).toEqual({ bar: 4, beat: 3, beatFraction: 0.5 })
  })

  it('uses the denominator as the beat unit', () => {
    const map = BarMap.fromSong(
      {
        ppq: 480,
        durationTicks: 1440,
        timeSignatureEvents: [{ tick: 0, numerator: 6, denominator: 8 }],
      },
      null,
    )
    expect(map.ticksPerBeat(1)).toBe(240)
    expect(map.beatsPerBar(1)).toBe(6)
    expect(map.tickToPosition(1200)).toEqual({ bar: 1, beat: 6, beatFraction: 0 })
  })

  it('cuts a bar short when the meter changes mid-bar', () => {
    const map = BarMap.fromSong(
      {
        ppq: 480,
        durationTicks: 4000,
        timeSignatureEvents: [
          { tick: 0, numerator: 4, denominator: 4 },
          { tick: 2400, numerator: 3, denominator: 4 },
        ],
      },
      null,
    )
    expect(map.barStartTick(2)).toBe(1920)
    expect(map.barEndTick(2)).toBe(2400)
    expect(map.barStartTick(3)).toBe(2400)
  })

  it('lists beat ticks across meter changes and before tick 0', async () => {
    const map = BarMap.fromSong(await songFrom(synthFixtures.meterChanges()), null)
    expect(map.beatTicksBetween(3360, 4800)).toEqual([3360, 3840, 4320])
    expect(map.beatTicksBetween(-1000, 1)).toEqual([-960, -480, 0])
    expect(map.tickToPosition(-480)).toEqual({ bar: 0, beat: 4, beatFraction: 0 })
    expect(map.tickToPosition(-2400).bar).toBe(-1)
  })
})

describe('BarMap — meter override', () => {
  const threeFour = { numerator: 3, denominator: 4 }

  it('makes a pickup into bar 0, counted on the grid ending at bar 1', async () => {
    const map = BarMap.fromSong(await songFrom(synthFixtures.pickup()), {
      timeSignature: threeFour,
      barOneStartTick: 480,
    })
    expect(map.hasBarZero).toBe(true)
    expect(map.firstBar).toBe(0)
    expect(map.barStartTick(0)).toBe(0)
    expect(map.barEndTick(0)).toBe(480)
    expect(map.barStartTick(1)).toBe(480)
    expect(map.barCount).toBe(3)
    expect(map.tickToPosition(0)).toEqual({ bar: 0, beat: 3, beatFraction: 0 })
    expect(map.tickToPosition(480)).toEqual({ bar: 1, beat: 1, beatFraction: 0 })
    expect(map.tickToPosition(-480)).toEqual({ bar: 0, beat: 2, beatFraction: 0 })
  })

  it('without an override, a pickup file starts bar 1 at tick 0', async () => {
    const map = BarMap.fromSong(await songFrom(synthFixtures.pickup()), null)
    expect(map.hasBarZero).toBe(false)
    expect(map.barStartTick(2)).toBe(1440)
  })

  it('replaces the file meter of Invention 1', async () => {
    const song = await songFrom(readFixture('invention-1.mid'))
    const fourFour = { numerator: 4, denominator: 4 }
    const map = BarMap.fromSong(song, { timeSignature: fourFour, barOneStartTick: 0 })
    expect(map.hasBarZero).toBe(false)
    expect(map.beatsPerBar(1)).toBe(4)
    expect(map.barStartTick(2)).toBe(1920)
    expect(map.barCount).toBe(Math.ceil(87839 / 1920))

    // Lead-in silence before the first note becomes bar 0.
    const leadIn = BarMap.fromSong(song, { timeSignature: fourFour, barOneStartTick: 1200 })
    expect(leadIn.hasBarZero).toBe(true)
    expect(leadIn.tickToPosition(1200)).toEqual({ bar: 1, beat: 1, beatFraction: 0 })
    expect(leadIn.tickToPosition(600).bar).toBe(0)
  })
})
