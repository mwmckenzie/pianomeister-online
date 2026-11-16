// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readFixture, type FixtureName } from '../testing/readFixture'
import { synthFixtures } from '../testing/synthFixtures'
import { importMidi } from './importMidi'

const load = (name: FixtureName) => importMidi(readFixture(name), { fileName: name })

describe('importMidi — real fixtures', () => {
  it('reads the Minuet in G', async () => {
    const song = await load('minuet-in-g.mid')
    expect(song.format).toBe(1)
    expect(song.ppq).toBe(480)
    expect(song.trackCount).toBe(2)
    expect(song.channels.map((c) => [c.channel, c.noteCount])).toEqual([
      [0, 258],
      [1, 150],
    ])
    expect(song.channels[0]?.averagePitch).toBeGreaterThan(song.channels[1]?.averagePitch ?? 99)
    expect(song.notes[0]?.startTick).toBe(0)
    expect(song.durationTicks).toBe(92159)
    expect(song.durationSeconds).toBeCloseTo(91.428, 2)
    // Repeated meta events at bar 17 are kept raw; the BarMap dedupes them.
    expect(song.timeSignatureEvents.map((e) => e.tick)).toEqual([0, 23040])
    for (const e of song.tempoEvents) expect(60e6 / e.microsPerQuarter).toBeCloseTo(126, 2)
  })

  it('reads Canon in D, including its tempo changes', async () => {
    const song = await load('canon-in-d.mid')
    expect(song.tempoEvents.map((e) => e.tick)).toEqual([0, 192000, 192479, 192960, 193919])
    expect(song.tempoEvents.map((e) => Math.round(60e6 / e.microsPerQuarter))).toEqual([
      100, 50, 100, 50, 100,
    ])
    expect(song.timeSignatureEvents).toEqual([{ tick: 0, numerator: 4, denominator: 4 }])
    expect(song.notes.find((n) => n.channel === 0)?.startTick).toBe(7680)
    expect(song.notes.find((n) => n.channel === 1)?.startTick).toBe(0)
    expect(song.durationTicks).toBe(195839)
    expect(song.durationSeconds).toBeCloseTo(246.596, 2)
    expect(song.notes.every((n) => n.velocity >= 0 && n.velocity <= 127)).toBe(true)
  })

  it('reads Invention 1', async () => {
    const song = await load('invention-1.mid')
    expect(song.timeSignatureEvents).toEqual([{ tick: 0, numerator: 3, denominator: 4 }])
    expect(song.notes[0]).toMatchObject({ channel: 0, startTick: 1200 })
    expect(song.notes.find((n) => n.channel === 1)?.startTick).toBe(3360)
    expect(song.durationTicks).toBe(87839)
    expect(song.durationSeconds).toBeCloseTo(97.167, 2)
  })

  it('identifies songs by the SHA-256 of their bytes, not the file name', async () => {
    const a = await load('minuet-in-g.mid')
    const b = await importMidi(readFixture('minuet-in-g.mid'), { fileName: 'renamed.mid' })
    const c = await load('canon-in-d.mid')
    expect(a.id).toMatch(/^[0-9a-f]{64}$/)
    expect(b.id).toBe(a.id)
    expect(c.id).not.toBe(a.id)
  })

  it('ignores names of tracks that hold notes and falls back to the file name', async () => {
    // Both first tracks hold notes: "Piano" names an instrument; the Invention's name only
    // happens to be descriptive. Bundled songs get real titles from the manifest instead.
    expect((await load('minuet-in-g.mid')).title).toBe('minuet-in-g')
    expect((await load('invention-1.mid')).title).toBe('invention-1')
  })
})

describe('importMidi — synthetic fixtures', () => {
  it('splits a Type 0 track into notes by channel', async () => {
    const song = await importMidi(synthFixtures.type0(), { fileName: 'x.mid' })
    expect(song.format).toBe(0)
    expect(song.trackCount).toBe(1)
    expect(song.title).toBe('Type Zero')
    expect(song.channels).toEqual([
      { channel: 0, noteCount: 2, minPitch: 72, maxPitch: 74, averagePitch: 73 },
      { channel: 1, noteCount: 2, minPitch: 43, maxPitch: 48, averagePitch: 45.5 },
    ])
    expect(song.notes.map((n) => [n.channel, n.midi, n.startTick, n.endTick])).toEqual([
      [1, 48, 0, 1920],
      [0, 72, 0, 480],
      [0, 74, 480, 960],
      [1, 43, 1920, 3840],
    ])
  })

  it('groups by channel across a conductor track, split tracks and an empty track', async () => {
    const song = await importMidi(synthFixtures.conductorAndSplitTracks(), { fileName: 'x.mid' })
    expect(song.ppq).toBe(120)
    expect(song.trackCount).toBe(4)
    expect(song.channels.map((c) => [c.channel, c.noteCount])).toEqual([
      [0, 2],
      [1, 2],
    ])
    expect(song.title).toBe('Conductor')
    expect(song.tempoEvents).toEqual([{ tick: 0, microsPerQuarter: 666_667 }])
    expect(song.timeSignatureEvents).toEqual([{ tick: 0, numerator: 3, denominator: 4 }])
    expect(song.durationTicks).toBe(720)
  })

  it('leaves tempo and meter empty when the file has none, and falls back to the file name', async () => {
    const song = await importMidi(synthFixtures.noMeta(), { fileName: 'My Song.mid' })
    expect(song.tempoEvents).toEqual([])
    expect(song.timeSignatureEvents).toEqual([])
    expect(song.title).toBe('My Song')
    // 3840 ticks at the default 120 BPM, 480 ppq.
    expect(song.durationSeconds).toBeCloseTo(4, 6)
  })

  it('keeps overlapping same-pitch notes separate and drops zero-length notes', async () => {
    const song = await importMidi(synthFixtures.overlapping(), { fileName: 'x.mid' })
    expect(song.notes.map((n) => [n.midi, n.startTick, n.endTick, n.velocity])).toEqual([
      [64, 0, 480, 127],
      [64, 240, 720, 64],
    ])
  })

  it('treats velocity-0 note-ons (with running status) as note-offs', async () => {
    const song = await importMidi(synthFixtures.velocityZeroNoteOffs(), { fileName: 'x.mid' })
    expect(song.notes.map((n) => [n.midi, n.startTick, n.endTick])).toEqual([
      [60, 0, 96],
      [64, 0, 192],
    ])
  })

  it('rejects bytes that are not a MIDI file', async () => {
    await expect(importMidi(new Uint8Array([1, 2, 3]), { fileName: 'x' })).rejects.toThrow(/MThd/)
  })
})
