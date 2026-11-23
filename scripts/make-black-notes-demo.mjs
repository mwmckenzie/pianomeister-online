// Writes test-fixtures/midi/black-notes-demo.mid: a short synthetic piece (our own content) for
// the milestone 9.2 black-note sheets: white-key chords next to black keys, with long sustains
// (for the raised black sustains) near and far from the keys when the frame is taken at bar 2,
// plus short white/black runs so heads show on their own. Run with:
// node scripts/make-black-notes-demo.mjs

import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import tonejsMidi from '@tonejs/midi'

const { Midi } = tonejsMidi
const PPQ = 480
const BAR = PPQ * 4

const midi = new Midi()
midi.header.name = 'Black notes demo'
midi.header.tempos.push({ ticks: 0, bpm: 80 })
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
midi.header.update()

const track = midi.addTrack()
track.channel = 0
track.name = 'Right hand'
const note = (m, ticks, beats, velocity = 0.7) =>
  track.addNote({ midi: m, ticks, durationTicks: Math.round(beats * PPQ), velocity })

// First, the occlusion case: A3 and B3 with A♯3 a 32nd later, between them and just behind
// their heads, so a nearer white head stands in front of a taller black one (bar 1, beat 3).
for (const m of [57, 59]) note(m, 2 * PPQ, 1)
note(58, 2 * PPQ + PPQ / 8, 1)
// Near: a C major chord with C♯ and F♯ sounding beside it, the black ones starting half a beat later.
for (const m of [60, 64, 67]) note(m, BAR, 3)
for (const m of [61, 66]) note(m, BAR + PPQ / 2, 2.5)
// Then D minor with E♭ and B♭ beside it.
for (const m of [62, 65, 69]) note(m, BAR + 2 * PPQ, 3)
for (const m of [63, 70]) note(m, BAR + 2 * PPQ, 2)
// Far: a run alternating white and black keys, then a long F chord with B♭ and D♭.
for (let k = 0; k < 8; k++) note(53 + k, 2 * BAR + 2 * PPQ + k * (PPQ / 2), 0.4)
for (const m of [53, 57, 60]) note(m, 3 * BAR + 2 * PPQ, 4)
for (const m of [58, 61]) note(m, 3 * BAR + 2 * PPQ, 3)
// A quiet tail so the song is long enough to step to bar 2 and look ahead.
note(48, 6 * BAR, 4, 0.3)

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'test-fixtures',
  'midi',
  'black-notes-demo.mid',
)
await writeFile(out, Buffer.from(midi.toArray()))
console.log(`wrote ${out}`)
