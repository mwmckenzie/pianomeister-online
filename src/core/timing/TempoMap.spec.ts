// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import { readFixture } from '../testing/readFixture'
import { TempoMap } from './TempoMap'

const canonTempoMap = async () => {
  const song = await importMidi(readFixture('canon-in-d.mid'), { fileName: 'c' })
  return new TempoMap(song.ppq, song.tempoEvents)
}

describe('TempoMap', () => {
  it('defaults to 120 BPM with no tempo events', () => {
    const map = new TempoMap(480, [])
    expect(map.tickToSeconds(480)).toBe(0.5)
    expect(map.bpmAt(0)).toBe(120)
  })

  it('uses 120 BPM before a first tempo event that is after tick 0', () => {
    const map = new TempoMap(480, [{ tick: 960, microsPerQuarter: 1_000_000 }])
    expect(map.tickToSeconds(960)).toBe(1)
    expect(map.tickToSeconds(1440)).toBe(2)
  })

  it('lets the last of several same-tick events win', () => {
    const map = new TempoMap(480, [
      { tick: 0, microsPerQuarter: 1_000_000 },
      { tick: 0, microsPerQuarter: 250_000 },
    ])
    expect(map.tickToSeconds(480)).toBe(0.25)
  })

  it('extrapolates negative ticks and seconds with the first tempo', () => {
    const map = new TempoMap(480, [
      { tick: 0, microsPerQuarter: 1_000_000 },
      { tick: 480, microsPerQuarter: 500_000 },
    ])
    expect(map.tickToSeconds(-480)).toBe(-1)
    expect(map.secondsToTick(-2)).toBe(-960)
  })

  it('converts across the Canon in D tempo changes', async () => {
    const map = await canonTempoMap()
    expect(map.tickToSeconds(7680)).toBeCloseTo(9.6, 2)
    expect(map.tickToSeconds(192000)).toBeCloseTo(240, 2)
    expect(map.tickToSeconds(195839)).toBeCloseTo(246.596, 2)
    expect(map.bpmAt(192100)).toBeCloseTo(50, 2)
    expect(map.bpmAt(192479)).toBeCloseTo(100, 2)
  })

  it('round-trips ticks through seconds', async () => {
    const map = await canonTempoMap()
    for (const tick of [-100, 0, 1, 191999, 192000, 192300, 192700, 193919, 195839]) {
      expect(map.secondsToTick(map.tickToSeconds(tick))).toBeCloseTo(tick, 6)
    }
  })

  it('rejects a non-positive ppq', () => {
    expect(() => new TempoMap(0, [])).toThrow(RangeError)
  })
})
