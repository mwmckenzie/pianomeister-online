// Writes test-fixtures/midi/pedal-demo.mid: a short synthetic piece (our own content) with the
// sustain pedal pressed and released each bar on the right-hand channel, so pedal shading and
// sustained sound can be checked by eye and ear. Run with: node scripts/make-pedal-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BAR = PPQ * 4
const CHORDS = [
  [60, 64, 67, 72], // C
  [57, 60, 64, 69], // Am
  [53, 57, 60, 65], // F
  [55, 59, 62, 67], // G
]
const BASS = [48, 45, 41, 43]

const midi = new Midi()
midi.header.name = 'Pedal demo'
midi.header.tempos.push({ ticks: 0, bpm: 84 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
midi.header.update()

const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

for (let bar = 0; bar < 8; bar++) {
  const chord = CHORDS[bar % CHORDS.length]
  const start = bar * BAR
  // Broken chord in eighths, each note written short: the pedal makes them ring.
  for (let i = 0; i < 8; i++) {
    const midiNote = chord[i % chord.length] + (i >= 4 ? 12 : 0)
    right.addNote({
      midi: midiNote,
      ticks: start + i * (PPQ / 2),
      durationTicks: PPQ / 4,
      velocity: 0.62,
    })
  }
  left.addNote({ midi: BASS[bar % BASS.length], ticks: start, durationTicks: PPQ, velocity: 0.7 })
  // Legato pedalling: up at the bar line, down again just after the new harmony sounds.
  // The last two bars are played dry, to show the band ending.
  if (bar < 6) {
    right.addCC({ number: 64, ticks: start + PPQ / 8, value: 1 })
    right.addCC({ number: 64, ticks: start + BAR - 1, value: 0 })
  }
}

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'pedal-demo.mid',
)
await writeFile(target, midi.toArray())
console.log(`wrote ${target}`)
