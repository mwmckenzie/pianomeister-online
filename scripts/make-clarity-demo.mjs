// Writes test-fixtures/midi/clarity-demo.mid: a short synthetic piece (our own content) for
// checking visual clarity: neighbouring sharp/natural notes sounding together (black-lane lift
// and contact shadow), very short and long notes (head bevels), repeated notes on one key
// (key re-strikes) and a velocity ramp (effect sizes). Run with: node scripts/make-clarity-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BAR = PPQ * 4

const midi = new Midi()
midi.header.name = 'Clarity demo'
midi.header.tempos.push({ ticks: 0, bpm: 90 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
midi.header.update()

const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

const note = (track, pitch, ticks, durationTicks, velocity = 90) =>
  track.addNote({ midi: pitch, ticks, durationTicks, velocity: velocity / 127 })

// Bars 1–2: sharp/natural neighbours together, half notes (C–C#, D#–E, F#–G, A#–B).
const PAIRS = [
  [60, 61],
  [63, 64],
  [66, 67],
  [70, 71],
]
PAIRS.forEach(([a, b], i) => {
  const start = i * (PPQ * 2)
  note(right, a, start, PPQ * 2)
  note(right, b, start, PPQ * 2)
})
// Left hand: the same idea, an octave and a half lower, whole notes.
note(left, 48, 0, BAR, 80)
note(left, 49, 0, BAR, 80)
note(left, 54, BAR, BAR, 80)
note(left, 55, BAR, BAR, 80)

// Bar 3: very short notes (32nds) alternating natural/sharp, then a long cluster in bar 4.
for (let i = 0; i < 16; i++) {
  note(right, i % 2 === 0 ? 62 : 63, 2 * BAR + i * (PPQ / 4), PPQ / 8, 70)
}
for (const pitch of [61, 62, 63, 64, 65]) note(right, pitch, 3 * BAR, BAR)
note(left, 41, 3 * BAR, BAR, 80)
note(left, 42, 3 * BAR, BAR, 80)

// Bar 5: one key repeated back to back (each note ends exactly where the next starts).
for (let i = 0; i < 8; i++) note(right, 64, 4 * BAR + i * (PPQ / 2), PPQ / 2, 85)
note(left, 52, 4 * BAR, BAR, 70)

// Bars 6–7: a chromatic run with velocity rising from 20 to 127, in eighths.
for (let i = 0; i < 16; i++) {
  const velocity = Math.round(20 + (107 * i) / 15)
  note(right, 60 + (i % 12), 5 * BAR + i * (PPQ / 2), PPQ / 2, velocity)
}
note(left, 48, 5 * BAR, 2 * BAR, 60)

// Bar 8: a final chord with sharps and naturals interleaved.
for (const pitch of [60, 61, 63, 64, 66, 67]) note(right, pitch, 7 * BAR, BAR, 100)
note(left, 36, 7 * BAR, BAR, 100)
note(left, 37, 7 * BAR, BAR, 100)

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'clarity-demo.mid',
)
await writeFile(target, midi.toArray())
console.log(`wrote ${target}`)
