// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import { readFixture } from '../testing/readFixture'
import { synthFixtures } from '../testing/synthFixtures'
import { computeSongFacts } from './computeSongFacts'
import { FACTS_VERSION } from './FACTS_VERSION'

describe('computeSongFacts', () => {
  it('summarises the Minuet, collapsing its repeated 3/4 events', async () => {
    const song = await importMidi(readFixture('minuet-in-g.mid'), { fileName: 'm.mid' })
    expect(computeSongFacts(song)).toEqual({
      factsVersion: FACTS_VERSION,
      durationSeconds: 91.427,
      durationTicks: 92159,
      ppq: 480,
      bars: 64,
      timeSignatures: ['3/4'],
      bpm: 126,
      bpmMin: 126,
      bpmMax: 126,
      channels: [
        { channel: 0, noteCount: 258, minPitch: 59, maxPitch: 83, averagePitch: 71.43 },
        { channel: 1, noteCount: 150, minPitch: 43, maxPitch: 64, averagePitch: 56.44 },
      ],
      meter: { main: '3/4', changes: 0, runs: [{ bar: 1, meter: '3/4' }] },
    })
  })

  it("doesn't let the Canon's closing ritardando set its tempo range", async () => {
    const song = await importMidi(readFixture('canon-in-d.mid'), { fileName: 'c.mid' })
    expect(Math.min(...song.tempoEvents.map((e) => 60e6 / e.microsPerQuarter))).toBeLessThan(60)
    expect(computeSongFacts(song)).toMatchObject({ bpm: 100, bpmMin: 100, bpmMax: 100 })
  })

  it('summarises a meter that changes: the most-used meter, and every change by bar', async () => {
    const song = await importMidi(readFixture('meter-demo.mid'), { fileName: 'meter-demo.mid' })
    expect(computeSongFacts(song)).toMatchObject({
      bars: 14,
      timeSignatures: ['4/4', '3/4', '6/8', '5/4', '4/4'],
      meter: {
        main: '4/4',
        changes: 4,
        runs: [
          { bar: 1, meter: '4/4' },
          { bar: 3, meter: '3/4' },
          { bar: 6, meter: '6/8' },
          { bar: 9, meter: '5/4' },
          { bar: 11, meter: '4/4' },
        ],
      },
    })
  })

  it('uses the defaults (4/4, 120 BPM) when the file has no meta events', async () => {
    const song = await importMidi(synthFixtures.noMeta(), { fileName: 'x.mid' })
    expect(computeSongFacts(song)).toMatchObject({
      timeSignatures: ['4/4'],
      bpm: 120,
      bpmMin: 120,
      bpmMax: 120,
      bars: 2,
    })
  })
})
