// Writes test-fixtures/midi/fills-demo.mid: a short synthetic piece (our own content) for the
// note-fill contact sheets (milestone 9): long notes in yellow (D), red (C), green (G) and
// purple (A), near and far from the keys when the frame is taken at bar 2, plus short notes so
// heads show on their own. Run with: node scripts/make-fills-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BAR = PPQ * 4
/** One lane per colour, spread across the middle of the keyboard. */
const LANES = [
  { midi: 50, name: 'D3 yellow' },
  { midi: 60, name: 'C4 red' },
  { midi: 67, name: 'G4 green' },
  { midi: 81, name: 'A5 purple' },
]

const midi = new Midi()
midi.header.name = 'Fills demo'
midi.header.tempos.push({ ticks: 0, bpm: 84 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
midi.header.update()

const track = midi.addTrack()
track.channel = 0
track.name = 'Right hand'

LANES.forEach((lane, i) => {
  // Near: a long note starting just after bar 2's downbeat, staggered by lane.
  track.addNote({
    midi: lane.midi,
    ticks: BAR + (i * PPQ) / 2,
    durationTicks: PPQ * 3,
    velocity: 0.7,
  })
  // Far: a long note a bar later, and short notes after it (heads on their own).
  track.addNote({
    midi: lane.midi + 12 * (i % 2 === 0 ? 1 : -1),
    ticks: 2 * BAR + i * PPQ,
    durationTicks: PPQ * 2,
    velocity: 0.7,
  })
  for (let k = 0; k < 3; k++) {
    track.addNote({
      midi: lane.midi,
      ticks: 3 * BAR + i * (PPQ / 4) + k * PPQ,
      durationTicks: PPQ / 4,
      velocity: 0.7,
    })
  }
})
// A quiet tail so the song is long enough to step to bar 2 and look ahead.
track.addNote({ midi: 48, ticks: 5 * BAR, durationTicks: BAR, velocity: 0.3 })

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'fills-demo.mid',
)
await writeFile(out, Buffer.from(midi.toArray()))
console.log(`wrote ${out}`)
