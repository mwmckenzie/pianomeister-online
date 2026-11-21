// Writes test-fixtures/midi/long-demo.mid: a long synthetic piece (our own content) for the
// overview's perf check (milestone 8): 340 bars of 4/4 at 132 bpm — sixteenths in the right
// hand over a three-note chord per beat in the left. Milestone 9's effects perf check adds a
// dense opening: bars 1–24 are ten-note chords (five per hand) on every sixteenth with the
// sustain pedal down, the worst case for particles and glow.
// Run with: node scripts/make-long-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BARS = 340
/** A I–vi–IV–V progression, a bar each: root notes for the left hand's chords. */
const ROOTS = [48, 45, 41, 43]
const MAJOR = [0, 4, 7]
const MINOR = [0, 3, 7]
/** The right hand runs up and down two octaves of C major. */
const SCALE = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]

const midi = new Midi()
midi.header.name = 'Long demo'
midi.header.tempos.push({ ticks: 0, bpm: 132 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })

const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

const sixteenth = PPQ / 4
/** Bars of ten-note chords at the start (milestone 9). */
const DENSE_BARS = 24
const RIGHT_CHORD = [0, 4, 7, 11, 14]
const LEFT_CHORD = [0, 7, 12, 16, 19]
for (let bar = 0; bar < DENSE_BARS; bar++) {
  const start = bar * PPQ * 4
  const root = ROOTS[bar % ROOTS.length]
  // Pedal down for each bar, lifted just before the next.
  right.addCC({ number: 64, value: 1, ticks: start })
  right.addCC({ number: 64, value: 0, ticks: start + PPQ * 4 - 10 })
  for (let t = 0; t < PPQ * 4; t += sixteenth) {
    for (const interval of RIGHT_CHORD) {
      right.addNote({
        midi: root + 24 + interval,
        ticks: start + t,
        durationTicks: sixteenth * 0.9,
        velocity: 0.75,
      })
    }
    for (const interval of LEFT_CHORD) {
      left.addNote({
        midi: root - 12 + interval,
        ticks: start + t,
        durationTicks: sixteenth * 0.9,
        velocity: 0.65,
      })
    }
  }
}
let step = 0
let direction = 1
for (let bar = DENSE_BARS; bar < BARS; bar++) {
  const start = bar * PPQ * 4
  const root = ROOTS[bar % ROOTS.length]
  const chord = bar % ROOTS.length === 1 ? MINOR : MAJOR
  for (let beat = 0; beat < 4; beat++) {
    for (const interval of chord) {
      left.addNote({
        midi: root + interval,
        ticks: start + beat * PPQ,
        durationTicks: PPQ * 0.9,
        velocity: beat === 0 ? 0.7 : 0.5,
      })
    }
  }
  for (let t = 0; t < PPQ * 4; t += sixteenth) {
    right.addNote({
      midi: SCALE[step],
      ticks: start + t,
      durationTicks: sixteenth * 0.9,
      velocity: t === 0 ? 0.8 : 0.6,
    })
    if (step + direction < 0 || step + direction >= SCALE.length) direction = -direction
    step += direction
  }
}
midi.header.update()

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'long-demo.mid',
)
await writeFile(target, Buffer.from(midi.toArray()))
const notes = midi.tracks.reduce((sum, t) => sum + t.notes.length, 0)
console.log(`Wrote ${target}: ${BARS} bars, ${notes} notes`)
