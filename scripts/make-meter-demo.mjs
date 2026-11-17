// Writes test-fixtures/midi/meter-demo.mid: a short synthetic piece (our own content) whose meter
// changes several times — 4/4, 3/4, 6/8, 5/4 and back to 4/4 — for checking the meter summary
// ("4/4 · 4 changes" and its popover), the bar map and the grouped beat dots (6/8 = 3+3).
// Run with: node scripts/make-meter-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
/** Each section: meter and bar count. 4/4 covers the most bars (2 + 4), so it's the main meter. */
const SECTIONS = [
  { numerator: 4, denominator: 4, bars: 2 },
  { numerator: 3, denominator: 4, bars: 3 },
  { numerator: 6, denominator: 8, bars: 3 },
  { numerator: 5, denominator: 4, bars: 2 },
  { numerator: 4, denominator: 4, bars: 4 },
]
const SCALE = [60, 62, 64, 65, 67, 69, 71, 72]

const midi = new Midi()
midi.header.name = 'Meter demo'
midi.header.tempos.push({ ticks: 0, bpm: 96 })

const right = midi.addTrack()
right.channel = 0
right.name = 'Right hand'
const left = midi.addTrack()
left.channel = 1
left.name = 'Left hand'

let tick = 0
let step = 0
for (const { numerator, denominator, bars } of SECTIONS) {
  midi.header.timeSignatures.push({ ticks: tick, timeSignature: [numerator, denominator] })
  const beat = (PPQ * 4) / denominator
  for (let bar = 0; bar < bars; bar++) {
    // One note per beat, the downbeat a little louder; a bass note on each downbeat.
    for (let b = 0; b < numerator; b++) {
      right.addNote({
        midi: SCALE[step++ % SCALE.length],
        ticks: tick + b * beat,
        durationTicks: beat * 0.9,
        velocity: b === 0 ? 0.8 : 0.6,
      })
    }
    left.addNote({ midi: 48, ticks: tick, durationTicks: beat * numerator * 0.9, velocity: 0.7 })
    tick += beat * numerator
  }
}
midi.header.update()

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'meter-demo.mid',
)
await writeFile(target, midi.toArray())
console.log(`wrote ${target}`)
