import { Midi } from '@tonejs/midi'

import { TempoMap } from '../timing/TempoMap'
import type { ChannelInfo } from './ChannelInfo'
import type { Note } from './Note'
import type { ParsedMidi } from './ParsedMidi'
import { pedalIntervals } from './pedalIntervals'
import { readControllerEvents } from './readControllerEvents'
import { readMidiHeader } from './readMidiHeader'
import { scanChannelEvents } from './scanChannelEvents'

const SUSTAIN_PEDAL = 64

/**
 * Parses a Standard MIDI File, synchronously (no id: hashing is async). Usable inside an
 * IndexedDB upgrade transaction. Notes are grouped by channel, not track:
 * @tonejs/midi splits tracks by (program, channel), so each parsed track's `channel` holds
 * for all its notes. Known upstream quirk: a program change between a note's on and off
 * can drop that note.
 */
export function parseMidi(bytes: Uint8Array, options: { readonly fileName: string }): ParsedMidi {
  const { format, trackCount } = readMidiHeader(bytes)
  const midi = new Midi(bytes)
  const ppq = midi.header.ppq

  const notes: Note[] = []
  for (const track of midi.tracks) {
    for (const n of track.notes) {
      // Zero-length notes are inaudible and would flash a key for no time.
      if (n.durationTicks <= 0) continue
      notes.push({
        midi: n.midi,
        channel: track.channel,
        startTick: n.ticks,
        endTick: n.ticks + n.durationTicks,
        velocity: Math.round(n.velocity * 127),
      })
    }
  }
  notes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi || a.channel - b.channel)

  const channels = channelInfo(notes)

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
    channels,
    tempoEvents,
    timeSignatureEvents,
    pedalIntervals: pedalIntervals(readControllerEvents(bytes, SUSTAIN_PEDAL), durationTicks),
    durationTicks,
    durationSeconds: tempoMap.tickToSeconds(durationTicks),
  }
}

function channelInfo(notes: readonly Note[]): ChannelInfo[] {
  const stats = new Map<number, { count: number; min: number; max: number; sum: number }>()
  for (const n of notes) {
    const s = stats.get(n.channel)
    if (s === undefined) stats.set(n.channel, { count: 1, min: n.midi, max: n.midi, sum: n.midi })
    else {
      s.count++
      s.min = Math.min(s.min, n.midi)
      s.max = Math.max(s.max, n.midi)
      s.sum += n.midi
    }
  }
  return [...stats]
    .sort((a, b) => a[0] - b[0])
    .map(([channel, s]) => ({
      channel,
      noteCount: s.count,
      minPitch: s.min,
      maxPitch: s.max,
      averagePitch: s.sum / s.count,
    }))
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
