// Writes test-fixtures/midi/long-demo.mid: a long synthetic piece (our own content) for the
// overview's perf check (milestone 8): 340 bars of 4/4 at 132 bpm, 9,520 notes —
// sixteenths in the right hand over a three-note chord per beat in the left.
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
let step = 0
let direction = 1
for (let bar = 0; bar < BARS; bar++) {
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
