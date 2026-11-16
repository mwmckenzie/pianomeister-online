// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import { readFixture } from '../testing/readFixture'
import { synthFixtures } from '../testing/synthFixtures'
import { computeSongFacts } from './computeSongFacts'

describe('computeSongFacts', () => {
  it('summarises the Minuet, collapsing its repeated 3/4 events', async () => {
    const song = await importMidi(readFixture('minuet-in-g.mid'), { fileName: 'm.mid' })
    expect(computeSongFacts(song)).toEqual({
      durationSeconds: 91.427,
      durationTicks: 92159,
      ppq: 480,
      bars: 64,
      timeSignatures: ['3/4'],
      bpm: 126,
    })
  })

  it('uses the defaults (4/4, 120 BPM) when the file has no meta events', async () => {
    const song = await importMidi(synthFixtures.noMeta(), { fileName: 'x.mid' })
    expect(computeSongFacts(song)).toMatchObject({ timeSignatures: ['4/4'], bpm: 120, bars: 2 })
  })
})
