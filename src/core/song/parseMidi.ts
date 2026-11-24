import { Midi } from '@tonejs/midi'

import { extractNotes } from '../hands/extractNotes'
import { readMidiFile } from '../midi/readMidiFile'
import { TempoMap } from '../timing/TempoMap'
import { summariseChannels } from './summariseChannels'
import type { Note } from './Note'
import type { ParsedMidi } from './ParsedMidi'
import { pedalIntervals } from './pedalIntervals'
import { readControllerEvents } from './readControllerEvents'
import { readMidiHeader } from './readMidiHeader'
import { scanChannelEvents } from './scanChannelEvents'

const SUSTAIN_PEDAL = 64

/**
 * Parses a Standard MIDI File, synchronously (no id: hashing is async). Usable inside an
 * IndexedDB upgrade transaction. Notes come from the raw events (extractNotes), because their ids
 * need the track and event index that @tonejs/midi loses; tempo and meter come from tonejs. A
 * note never released sounds to the end of its track.
 */
export function parseMidi(bytes: Uint8Array, options: { readonly fileName: string }): ParsedMidi {
  const { format, trackCount } = readMidiHeader(bytes)
  const midi = new Midi(bytes)
  const ppq = midi.header.ppq

  const extracted = extractNotes(readMidiFile(bytes))
  const notes: Note[] = extracted
    // Zero-length notes are inaudible and would flash a key for no time.
    .filter((n) => n.endTick > n.startTick)
    .map(({ id, track, midi: pitch, channel, startTick, endTick, velocity }) => ({
      id,
      track,
      midi: pitch,
      channel,
      startTick,
      endTick,
      velocity,
    }))
  notes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi || a.channel - b.channel)

  const channels = summariseChannels(notes)

  // The file stores integer microseconds; tonejs hands back a derived float BPM.
  const tempoEvents = midi.header.tempos.map((t) => ({
    tick: t.ticks,
    microsPerQuarter: Math.round(60e6 / t.bpm),
  }))
  const timeSignatureEvents = midi.header.timeSignatures.map((t) => ({
    tick: t.ticks,
    numerator: t.timeSignature[0] ?? 4,
    denominator: t.timeSignature[1] ?? 4,
  }))

  const durationTicks = notes.reduce((max, n) => Math.max(max, n.endTick), 0)
  const tempoMap = new TempoMap(ppq, tempoEvents)

  return {
    title: songTitle(midi, bytes, format, options.fileName),
    format,
    trackCount,
    ppq,
    notes,
    noteIds: extracted.map((n) => n.id),
    channels,
    tempoEvents,
    timeSignatureEvents,
    pedalIntervals: pedalIntervals(readControllerEvents(bytes, SUSTAIN_PEDAL), durationTicks),
    durationTicks,
    durationSeconds: tempoMap.tickToSeconds(durationTicks),
  }
}

/**
 * The sequence name: the track name of a format 0 file, or of a format 1 file's conductor
 * track (a first track without notes). Other track names usually name the instrument
 * ("Piano"), so they're ignored in favour of the file name.
 */
function songTitle(midi: Midi, bytes: Uint8Array, format: number, fileName: string): string {
  const name = midi.header.name.trim()
  const isSequenceName = format === 0 || (format === 1 && !firstTrackHasNotes(bytes))
  return name !== '' && isSequenceName ? name : fileName.replace(/\.[^.]+$/, '')
}

function firstTrackHasNotes(bytes: Uint8Array): boolean {
  let found = false
  scanChannelEvents(bytes, (e) => {
    if (e.track === 0 && (e.status & 0xf0) === 0x90 && e.data2 > 0) found = true
  })
  return found
}
