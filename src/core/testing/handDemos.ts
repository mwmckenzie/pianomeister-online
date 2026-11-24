import type { HandLetter } from '../hands/HandLetter'
import type { RawNote } from '../hands/RawNote'
import type { MidiEvent } from '../midi/MidiEvent'
import { META_TRACK_NAME, type MidiFile } from '../midi/MidiFile'

/** Synthetic two-handed music with a known truth, after midi-transformer's demos. */
const PPQ = 480
const BAR = 4 * PPQ

interface DemoNote {
  readonly midi: number
  readonly start: number
  readonly length: number
  readonly hand: HandLetter
}

const CHORDS = [
  [48, 52, 55],
  [45, 48, 52],
  [41, 45, 48],
  [43, 47, 50],
]
const MELODY = [
  [76, 74, 72, 74],
  [76, 76, 76, 79],
  [77, 76, 74, 72],
  [74, 71, 74, 67],
]

function demoNotes(): DemoNote[] {
  const notes: DemoNote[] = []
  const add = (midi: number, start: number, length: number, hand: HandLetter) =>
    notes.push({ midi, start, length, hand })
  for (let bar = 0; bar < 8; bar++) {
    const at = bar * BAR
    const up = bar < 4 ? 0 : 12
    const chord = CHORDS[bar % 4] as number[]
    const melody = MELODY[bar % 4] as number[]
    add((chord[0] as number) - 12, at, 2 * PPQ, 'L')
    chord.forEach((p, i) => add(p, at + PPQ * (i + 1), PPQ, 'L'))
    melody.forEach((p, i) => add(p + up, at + PPQ * i, PPQ * 0.9, 'R'))
    add((melody[0] as number) - 4 + up, at, 2 * PPQ, 'R')
  }
  for (const p of [36, 43, 48]) add(p, 8 * BAR, BAR, 'L')
  for (const p of [64, 67, 72, 76]) add(p, 8 * BAR, BAR, 'R')
  return notes
}

export const demoMidi = {
  name: (text: string): MidiEvent => ({
    kind: 'meta',
    tick: 0,
    metaType: META_TRACK_NAME,
    data: new TextEncoder().encode(text),
  }),
  program: (channel: number, program: number): MidiEvent => ({
    kind: 'programChange',
    tick: 0,
    channel,
    program,
  }),
  pedal: (tick: number, channel: number, down: boolean): MidiEvent => ({
    kind: 'controller',
    tick,
    channel,
    controller: 64,
    value: down ? 127 : 0,
  }),
  /** Note-offs before note-ons at the same tick. */
  notes: (
    notes: readonly { readonly midi: number; readonly start: number; readonly length: number }[],
    channel: number,
  ): MidiEvent[] =>
    notes
      .flatMap((n): MidiEvent[] => [
        { kind: 'noteOn', tick: n.start, channel, note: n.midi, velocity: 80 },
        {
          kind: 'noteOff',
          tick: Math.round(n.start + n.length),
          channel,
          note: n.midi,
          velocity: 0,
        },
      ])
      .sort(
        (a, b) => a.tick - b.tick || Number(b.kind === 'noteOff') - Number(a.kind === 'noteOff'),
      ),
  file: (tracks: readonly (readonly MidiEvent[])[]): MidiFile => ({
    format: 1,
    division: PPQ,
    unknownChunks: [],
    tracks: tracks.map((events) => ({ events })),
  }),
}

/** Both hands in one track on channel 3, with sustain. */
export function demoCombined(): MidiFile {
  return demoMidi.file([
    [demoMidi.name('Demo')],
    [
      demoMidi.name('Piano'),
      demoMidi.program(3, 0),
      demoMidi.pedal(0, 3, true),
      ...demoMidi.notes(demoNotes(), 3),
      demoMidi.pedal(8 * BAR - 10, 3, false),
    ],
  ])
}

/** Hands on channels 5 and 2 of two tracks, plus strings on channel 0. */
export function demoSeparate(
  names: readonly [string, string] = ['Piano RH', 'Piano LH'],
): MidiFile {
  const all = demoNotes()
  const strings = all
    .filter((n) => n.hand === 'L' && n.start % BAR === 0)
    .map((n) => ({ ...n, midi: n.midi + 24, length: BAR }))
  const hand = (letter: HandLetter) => all.filter((n) => n.hand === letter)
  return demoMidi.file([
    [demoMidi.name('Demo')],
    [demoMidi.name(names[0]), demoMidi.program(5, 0), ...demoMidi.notes(hand('R'), 5)],
    [demoMidi.name(names[1]), demoMidi.program(2, 0), ...demoMidi.notes(hand('L'), 2)],
    [demoMidi.name('Strings'), demoMidi.program(0, 48), ...demoMidi.notes(strings, 0)],
  ])
}

/** The true hand of each demo note, by "start:pitch". */
export function demoTruth(): Map<string, HandLetter> {
  return new Map(demoNotes().map((n) => [`${n.start}:${n.midi}`, n.hand]))
}

/**
 * Human-style texture, seeded: held bass, inner voices near middle C, right-hand runs dipping
 * down, ±45-tick jitter.
 */
export function humanNotes(seed: number): (RawNote & { readonly truth: HandLetter })[] {
  let s = seed
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647
  const notes: (RawNote & { readonly truth: HandLetter })[] = []
  const add = (midi: number, start: number, length: number, truth: HandLetter) => {
    const jitter = Math.round((random() - 0.5) * 90)
    notes.push({
      id: `0:${notes.length}`,
      track: 0,
      channel: 0,
      midi,
      velocity: 70,
      startTick: Math.max(0, start + jitter),
      endTick: start + jitter + length,
      onIndex: 0,
      offIndex: 0,
      truth,
    })
  }
  for (let bar = 0; bar < 40; bar++) {
    const at = bar * BAR
    const root = 36 + Math.floor(random() * 12)
    if (bar % 2 === 0) {
      add(root, at, 4800, 'L')
      add(root + 7, at + 60, 4200, 'L')
    }
    const inner = 52 + Math.floor(random() * 12)
    add(inner, at + 960, 700, 'L')
    add(inner + 3, at + 1000, 650, 'L')
    const top = 70 + Math.floor(random() * 14)
    add(top, at, 900, 'R')
    const dip = random() < 0.4 ? 12 : 4
    for (let k = 0; k < 6; k++) {
      add(top - Math.round((k / 5) * dip) - (k % 2) * 2, at + 960 + k * 160, 150, 'R')
    }
  }
  return notes
}
