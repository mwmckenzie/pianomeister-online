// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { importMidi } from '../song/importMidi'
import type { Note } from '../song/Note'
import { readFixture } from '../testing/readFixture'
import { synthFixtures } from '../testing/synthFixtures'
import { applySustain } from './applySustain'

const songFrom = (bytes: Uint8Array) => importMidi(bytes, { fileName: 'x.mid' })

/** `channel:midi@start→soundEnd` for compact assertions. */
const summarize = (notes: readonly (Note & { soundEndTick: number })[]) =>
  notes.map((n) => `${n.channel}:${n.midi}@${n.startTick}→${n.soundEndTick}`)

describe('pedal import', () => {
  it('reads one interval for a pedal held across several notes, ignoring a repeated down', async () => {
    const song = await songFrom(synthFixtures.pedalSpan())
    expect(song.pedalIntervals).toEqual([{ channel: 0, startTick: 0, endTick: 1440 }])
  })

  it('reads the channel from the CC event, even in a track without notes', async () => {
    const song = await songFrom(synthFixtures.pedalOneChannel())
    // CC7 (volume) on ch1 is not a pedal; 64 counts as down and 63 as up.
    expect(song.pedalIntervals).toEqual([{ channel: 0, startTick: 0, endTick: 1920 }])
  })

  it('closes an unterminated pedal at the song end', async () => {
    const song = await songFrom(synthFixtures.unterminatedPedal())
    expect(song.durationTicks).toBe(1920)
    expect(song.pedalIntervals).toEqual([{ channel: 0, startTick: 480, endTick: 1920 }])
  })

  it('reads the committed pedal demo: one pedal per bar for six bars on the right hand', async () => {
    const song = await songFrom(readFixture('pedal-demo.mid'))
    expect(song.pedalIntervals).toHaveLength(6)
    expect(song.pedalIntervals.every((p) => p.channel === 0)).toBe(true)
    expect(song.pedalIntervals[0]).toEqual({ channel: 0, startTick: 60, endTick: 1919 })
    expect(song.channels).toEqual([
      { channel: 0, noteCount: 64, minPitch: expect.any(Number), maxPitch: expect.any(Number), averagePitch: expect.any(Number) },
      { channel: 1, noteCount: 8, minPitch: expect.any(Number), maxPitch: expect.any(Number), averagePitch: expect.any(Number) },
    ])
  })

  it('finds no pedal in files without CC64', async () => {
    expect((await songFrom(synthFixtures.type0())).pedalIntervals).toEqual([])
  })
})

describe('applySustain', () => {
  it('extends notes released under the pedal to pedal-up, and leaves later notes alone', async () => {
    const song = await songFrom(synthFixtures.pedalSpan())
    expect(summarize(applySustain(song.notes, song.pedalIntervals))).toEqual([
      '0:60@0→1440',
      '0:64@480→1440',
      '0:67@960→1440',
      '0:72@1920→2160',
    ])
  })

  it('cuts a sustained note when the same pitch is struck again', async () => {
    const song = await songFrom(synthFixtures.restruckUnderPedal())
    expect(summarize(applySustain(song.notes, song.pedalIntervals))).toEqual([
      '0:60@0→960',
      '0:62@0→1920',
      '0:60@960→1920',
    ])
  })

  it('only sustains the channel whose pedal is down', async () => {
    const song = await songFrom(synthFixtures.pedalOneChannel())
    expect(summarize(applySustain(song.notes, song.pedalIntervals))).toEqual([
      '1:48@0→240',
      '0:72@0→1920',
    ])
  })

  it('sustains to the song end under an unterminated pedal', async () => {
    const song = await songFrom(synthFixtures.unterminatedPedal())
    expect(summarize(applySustain(song.notes, song.pedalIntervals))).toEqual([
      '0:60@0→240',
      '0:64@480→1920',
      '0:67@1680→1920',
    ])
  })

  it('keeps the written endTick unchanged', async () => {
    const song = await songFrom(synthFixtures.pedalSpan())
    const sounding = applySustain(song.notes, song.pedalIntervals)
    expect(sounding.map((n) => n.endTick)).toEqual(song.notes.map((n) => n.endTick))
  })

  it('never shortens a note below its written length', () => {
    // Overlapping same-pitch notes: the second starts before the first ends.
    const notes: Note[] = [
      { midi: 60, channel: 0, startTick: 0, endTick: 480, velocity: 90 },
      { midi: 60, channel: 0, startTick: 240, endTick: 720, velocity: 90 },
    ]
    const sounding = applySustain(notes, [{ channel: 0, startTick: 0, endTick: 2000 }])
    expect(sounding.map((n) => n.soundEndTick)).toEqual([480, 2000])
  })
})
