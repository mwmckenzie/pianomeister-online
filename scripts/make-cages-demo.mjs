// Writes test-fixtures/midi/cages-demo.mid: a short synthetic piece (our own content) for the
// milestone 10 hand-cage sheets: both hands (channels 0 and 1), rests mid-song (carried bars),
// a leading rest in the left hand, notes held across bar lines, a 4/4 → 3/4 → 4/4 meter change,
// narrow passages at both ends of the keyboard, the hand moving up and down into narrow bars,
// and a pedal span.
// Run with: node scripts/make-cages-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BEAT = PPQ

const midi = new Midi()
midi.header.name = 'Cages demo'
midi.header.tempos.push({ ticks: 0, bpm: 90 })

const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

/** Bars 1–6 in 4/4, 7–8 in 3/4, 9–14 in 4/4: each bar's start tick and beats. */
const BARS = []
{
  let tick = 0
  for (let bar = 1; bar <= 14; bar++) {
    const beats = bar === 7 || bar === 8 ? 3 : 4
    BARS[bar] = { tick, beats }
    tick += beats * BEAT
  }
}
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
midi.header.timeSignatures.push({ ticks: BARS[7].tick, timeSignature: [3, 4] })
midi.header.timeSignatures.push({ ticks: BARS[9].tick, timeSignature: [4, 4] })

const at = (bar, beat) => BARS[bar].tick + beat * BEAT
const add = (track, midiNote, bar, beat, beats, velocity = 0.7) =>
  track.addNote({
    midi: midiNote,
    ticks: at(bar, beat),
    durationTicks: beats * BEAT - 20,
    velocity,
  })

// Right hand.
// Bars 1–2: a melody spanning a sixth (no widening).
;[72, 74, 76, 77, 79, 77, 76, 74].forEach((n, i) => add(right, n, 1 + Math.floor(i / 4), i % 4, 1))
// Bar 3: one note, lower than before (the hand moved down: widened up).
add(right, 71, 3, 0, 2)
add(right, 71, 3, 2, 2)
// Bars 4–5: rests (carried, dimmed).
// Bar 6: one note, higher (the hand moved up: widened down).
add(right, 84, 6, 0, 4)
// Bars 7–8 (3/4): a note held across the bar line, with a run under it.
add(right, 79, 7, 1, 3)
;[74, 76].forEach((n, i) => add(right, n, 7, i * 2 === 0 ? 0 : 2, 1))
;[77, 76].forEach((n, i) => add(right, n, 8, 1 + i, 1))
// Bars 9–10: high up, near C8 (clamped: widened down).
;[105, 107, 108, 107].forEach((n, i) => add(right, n, 9, i, 1))
add(right, 108, 10, 0, 4)
// Bars 11–12: a closing phrase; the right hand's last note is in bar 12.
;[67, 69, 71, 72].forEach((n, i) => add(right, n, 11, i, 1))
add(right, 72, 12, 0, 2)

// Left hand: bars 1–2 rest (no cages before its first note).
// Bars 3–6: a bass pattern.
for (let bar = 3; bar <= 6; bar++) {
  add(left, 43, bar, 0, 1)
  add(left, 50, bar, 1, 1)
  add(left, 55, bar, 2, 1)
  add(left, 50, bar, 3, 1)
}
// Bars 7–8 (3/4): a low note held across the bar line.
add(left, 41, 7, 0, 5)
add(left, 48, 8, 2, 1)
// Bars 9–10: the bottom of the keyboard, near A0 (clamped: widened up).
;[21, 23, 24, 23].forEach((n, i) => add(left, n, 9, i, 1))
add(left, 24, 10, 0, 4)
// Bar 11: a rest; bars 12–14: chords held across bar lines, into the right hand's silence.
for (const n of [36, 43, 48]) add(left, n, 12, 0, 6)
for (const n of [41, 45, 48]) add(left, n, 13, 2, 6)
// The pedal down over bars 12–13.
left.addCC({ number: 64, value: 1, ticks: at(12, 0) })
left.addCC({ number: 64, value: 0, ticks: at(14, 0) })

midi.header.update()

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'cages-demo.mid',
)
await writeFile(target, Buffer.from(midi.toArray()))
console.log(`wrote ${target}`)
