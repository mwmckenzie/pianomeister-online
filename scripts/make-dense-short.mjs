// Writes test-fixtures/midi/dense-short.mid: 28 bars of 4/4 at 120 bpm (our own content) for the
// perf fast loop's pixel comparison: five-note chords on every eighth, and drones of eight bars, so
// a window has many notes at its far edge and long ones at its near edge.
// Run with: node scripts/make-dense-short.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BARS = 28
const ROOTS = [48, 45, 41, 43]
const CHORD = [12, 16, 19, 23, 26]

const midi = new Midi()
midi.header.name = 'Dense short'
midi.header.tempos.push({ ticks: 0, bpm: 120 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

for (let bar = 0; bar < BARS; bar++) {
  const start = bar * PPQ * 4
  const root = ROOTS[bar % ROOTS.length]
  for (let i = 0; i < 8; i++) {
    for (const interval of CHORD) {
      right.addNote({
        midi: root + 12 + interval + (i % 2),
        ticks: start + (i * PPQ) / 2,
        durationTicks: PPQ * 0.45,
        velocity: 0.7,
      })
    }
  }
  if (bar % 8 === 0) {
    for (const interval of [0, 7, 10]) {
      left.addNote({
        midi: 36 + interval,
        ticks: start,
        durationTicks: PPQ * 4 * 8 - 20,
        velocity: 0.6,
      })
    }
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), '../test-fixtures/midi/dense-short.mid')
await writeFile(out, midi.toArray())
console.log(out)
