// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { buildSmf, ev } from '../testing/buildSmf'
import { readFixture } from '../testing/readFixture'
import { readControllerEvents } from './readControllerEvents'

describe('readControllerEvents', () => {
  it('walks whole real files: one volume, pan and reverb CC per channel, no pedal', () => {
    for (const name of ['minuet-in-g.mid', 'canon-in-d.mid', 'invention-1.mid'] as const) {
      const bytes = readFixture(name)
      expect(
        readControllerEvents(bytes, 7)
          .map((e) => e.channel)
          .sort(),
      ).toEqual([0, 1])
      expect(readControllerEvents(bytes, 10)).toHaveLength(2)
      expect(readControllerEvents(bytes, 64)).toEqual([])
    }
  })

  it('handles running status, meta and sysex events, and several tracks', () => {
    const bytes = buildSmf({
      format: 1,
      ppq: 96,
      tracks: [
        [ev.trackName(0, 'Conductor'), ev.tempo(0, 500_000)],
        [
          ev.trackName(0, 'Piano'),
          { tick: 10, bytes: [0xb2, 64, 127] },
          { tick: 20, bytes: [64, 0] }, // running status: CC64 off on channel 2
          { tick: 25, bytes: [0xf0, 3, 0x7e, 0x09, 0xf7] }, // sysex with a length prefix
          { tick: 30, bytes: [0xb2, 1, 50] }, // a different controller
          ev.noteOn(40, 2, 60),
          { tick: 50, bytes: [60, 0] }, // running status note-off
        ],
        [ev.cc(5, 9, 64, 100)],
      ],
    })
    expect(readControllerEvents(bytes, 64)).toEqual([
      { tick: 5, channel: 9, value: 100 },
      { tick: 10, channel: 2, value: 127 },
      { tick: 20, channel: 2, value: 0 },
    ])
  })

  it('rejects a data byte with no status to run from', () => {
    const bytes = buildSmf({ format: 0, ppq: 96, tracks: [[{ tick: 0, bytes: [64, 0] }]] })
    expect(() => readControllerEvents(bytes, 64)).toThrow(/status/)
  })
})
