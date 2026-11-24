// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { readMidiFile } from '../midi/readMidiFile'
import { writeMidiFile } from '../midi/writeMidiFile'
import { demoCombined, demoSeparate, demoTruth, humanNotes } from '../testing/handDemos'
import { applyHandAssignment } from './applyHandAssignment'
import { beamSplit } from './beamSplit'
import { clusterByTime } from './clusterByTime'
import { extractNotes } from './extractNotes'
import { fileSplitContext } from './fileSplitContext'
import { handsHash } from './handsHash'
import type { HandSettings } from './HandSettings'
import type { RawNote } from './RawNote'
import { resolveHands } from './resolveHands'
import { SPLIT_ALGORITHMS } from './SPLIT_ALGORITHMS'

const CONTEXT = { ticksPerBeat: 480, seconds: (tick: number) => (tick / 480) * 0.5 }
const note = (id: string, midi: number, startTick: number, length = 100): RawNote => ({
  id,
  track: 0,
  channel: 0,
  midi,
  velocity: 64,
  startTick,
  endTick: startTick + length,
  onIndex: 0,
  offIndex: 0,
})

describe('split methods', () => {
  it.each(SPLIT_ALGORITHMS.map((a) => [a.name, a] as const))(
    '%s gets over 90 %% of the demo right (criterion 6)',
    (_name, algorithm) => {
      const notes = extractNotes(demoCombined())
      const truth = demoTruth()
      const { hands } = algorithm.run(notes, {}, CONTEXT)
      const right = notes.filter((n) => hands.get(n.id) === truth.get(`${n.startTick}:${n.midi}`))
      expect(right.length / notes.length).toBeGreaterThan(0.9)
    },
  )

  it('lists Phrase look-ahead first, with the agreed names', () => {
    expect(SPLIT_ALGORITHMS.map((a) => a.name)).toEqual([
      'Phrase look-ahead',
      'Chord-aware',
      'Moving split point',
      'Fixed split point',
    ])
  })

  it.each([1, 2, 3])('look-ahead never swaps hands for long (criterion 7, seed %i)', (seed) => {
    const notes = humanNotes(seed)
    const { hands } = beamSplit.run(notes, {}, CONTEXT)
    let run = 0
    let worst = 0
    let correct = 0
    for (const n of [...notes].sort((a, b) => a.startTick - b.startTick)) {
      run = hands.get(n.id) === n.truth ? 0 : run + 1
      if (run === 0) correct++
      worst = Math.max(worst, run)
    }
    expect(worst).toBeLessThanOrEqual(4)
    expect(correct / notes.length).toBeGreaterThan(0.8)
  })

  it('groups chord notes by time (criterion 8)', () => {
    const clusters = clusterByTime(
      [note('a', 60, 0), note('b', 64, 20), note('c', 67, 200)],
      0.03,
      (t) => t / 1000,
    )
    expect(clusters.map((c) => c.notes.map((n) => n.id))).toEqual([['a', 'b'], ['c']])
  })
})

describe('uncertain notes', () => {
  it('are none when the hands are clearly apart', () => {
    const notes = Array.from({ length: 60 }, (_, i) => [
      note(`l${i}`, 36 + (i % 3), i * 240, 200),
      note(`r${i}`, 84 + (i % 3), i * 240, 200),
    ]).flat()
    expect(beamSplit.run(notes, {}, CONTEXT).uncertain.size).toBe(0)
  })

  it('are found throughout an ambiguous texture, not just in its last bars', () => {
    // One line wandering around middle C: either hand could play it.
    const notes = Array.from({ length: 80 }, (_, i) =>
      note(`n${i}`, 60 + Math.round(5 * Math.sin(i / 2)) + (i % 2) * 2, i * 240, 200),
    )
    const { uncertain } = beamSplit.run(notes, {}, CONTEXT)
    expect(uncertain.size).toBeGreaterThan(0)
    expect(notes.slice(0, 60).some((n) => uncertain.has(n.id))).toBe(true)
  })

  it('are never marked by the other methods', () => {
    for (const a of SPLIT_ALGORITHMS.slice(1)) {
      expect(a.run(humanNotes(1), {}, CONTEXT).uncertain.size).toBe(0)
    }
  })
})

describe('resolveHands', () => {
  const notes = [note('0:0', 72, 0), note('0:1', 40, 0)]
  const settings = (over: Partial<HandSettings>): HandSettings => ({
    roles: { '0:0': 'split' },
    algorithm: 'fixed',
    params: {},
    flips: {},
    ...over,
  })

  it('uses the method for Split, the role otherwise, and - for Hidden', () => {
    const hands = (over: Partial<HandSettings>) =>
      resolveHands(notes, settings(over), CONTEXT).hands
    expect(hands({})).toBe('RL')
    expect(hands({ params: { split: 80 } })).toBe('LL')
    expect(hands({ roles: { '0:0': 'left' } })).toBe('LL')
    expect(hands({ roles: { '0:0': 'hidden' } })).toBe('--')
    expect(hands({ roles: {} })).toBe('--')
  })

  it('puts flips over roles and methods, but not over Hidden', () => {
    const flips = { '0:0': 'L' } as const
    expect(resolveHands(notes, settings({ flips }), CONTEXT).hands).toBe('LL')
    expect(resolveHands(notes, settings({ flips, roles: { '0:0': 'right' } }), CONTEXT).hands).toBe(
      'LR',
    )
    expect(
      resolveHands(notes, settings({ flips, roles: { '0:0': 'hidden' } }), CONTEXT).hands,
    ).toBe('--')
  })

  it('falls back to the default method, with its defaults, for an unknown one', () => {
    const unknown = settings({ algorithm: 'from-the-future', params: { reach: 1 } })
    expect(resolveHands(notes, unknown, CONTEXT).hands).toBe(
      resolveHands(notes, settings({ algorithm: 'beam' }), CONTEXT).hands,
    )
  })

  it('has a hash that follows every input, and not their order', () => {
    const base = settings({ roles: { a: 'left', b: 'right' }, params: { x: 1 } })
    const hashes = [
      base,
      { ...base, algorithm: 'beam' },
      { ...base, params: { x: 2 } },
      { ...base, roles: { a: 'left', b: 'left' } as const },
      { ...base, flips: { '0:0': 'R' } as const },
    ].map(handsHash)
    expect(new Set(hashes).size).toBe(hashes.length)
    expect(handsHash({ ...base, roles: { b: 'right', a: 'left' } })).toBe(hashes[0])
  })
})

describe('applyHandAssignment', () => {
  const split = () => {
    const file = demoCombined()
    const notes = extractNotes(file)
    return { file, notes, hands: beamSplit.run(notes, {}, fileSplitContext(file)).hands }
  }
  const options = { rightChannel: 0, leftChannel: 1 }

  it('moves notes in place, round-tripping through write and parse (criterion 9)', () => {
    const { file, notes, hands } = split()
    const out = readMidiFile(
      writeMidiFile(applyHandAssignment(file, notes, hands, { ...options, layout: 'inPlace' })),
    )
    const after = extractNotes(out)
    expect(after).toHaveLength(notes.length)
    expect([...new Set(after.map((n) => n.channel))].sort()).toEqual([0, 1])
    const programs = out.tracks[1]?.events.filter((e) => e.kind === 'programChange')
    expect(programs?.map((e) => (e.kind === 'programChange' ? e.channel : -1))).toEqual([0, 1])
  })

  it('makes two tracks, with sustain in both (criterion 10)', () => {
    const { file, notes, hands } = split()
    for (const left of [1, 0]) {
      const out = applyHandAssignment(file, notes, hands, {
        rightChannel: 0,
        leftChannel: left,
        layout: 'twoTracks',
      })
      expect(out.tracks).toHaveLength(4)
      expect(extractNotes(readMidiFile(writeMidiFile(out)))).toHaveLength(notes.length)
      for (const track of [2, 3]) {
        const events = out.tracks[track]?.events ?? []
        expect(events.filter((e) => e.kind === 'controller')).toHaveLength(2)
        expect(events.some((e) => e.kind === 'noteOn')).toBe(true)
      }
    }
  })

  it('moves whole voices only where assigned (criterion 11)', () => {
    const file = demoSeparate()
    const notes = extractNotes(file)
    const left = new Map(notes.filter((n) => n.track === 2).map((n) => [n.id, 'L'] as const))
    const out = extractNotes(
      applyHandAssignment(file, notes, left, { ...options, layout: 'inPlace' }),
    )
    const channels = (track: number) => [
      ...new Set(out.filter((n) => n.track === track).map((n) => n.channel)),
    ]
    expect([channels(1), channels(2), channels(3)]).toEqual([[5], [1], [0]])
  })
})

describe('MIDI file round trip', () => {
  it('keeps every event kind, unknown chunks and long delta times', () => {
    const file = {
      format: 1 as const,
      division: 480,
      unknownChunks: [{ afterTrack: -1, id: 'XFIH', data: Uint8Array.of(1, 2) }],
      tracks: [
        {
          events: [
            { kind: 'sysex', tick: 0, status: 0xf0, data: Uint8Array.of(1, 0xf7) },
            { kind: 'pitchBend', tick: 1, channel: 2, value: 8193 },
            { kind: 'polyAftertouch', tick: 2, channel: 2, note: 60, pressure: 5 },
            { kind: 'channelAftertouch', tick: 3, channel: 2, pressure: 6 },
            { kind: 'meta', tick: 2_000_000, metaType: 0x2f, data: new Uint8Array(0) },
          ] as const,
        },
      ],
    }
    expect(readMidiFile(writeMidiFile(file))).toEqual(file)
  })

  it('reads running status across a meta event', () => {
    const track = [0, 0x90, 60, 80, 10, 0xff, 1, 0, 0, 60, 0, 0, 0xff, 0x2f, 0]
    const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96]
    const bytes = [...head, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, track.length, ...track]
    expect(extractNotes(readMidiFile(Uint8Array.from(bytes)))).toMatchObject([
      { midi: 60, startTick: 0, endTick: 10 },
    ])
  })
})
