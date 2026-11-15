import { Midi } from '@tonejs/midi'

import { TempoMap } from '../timing/TempoMap'
import type { ChannelInfo } from './ChannelInfo'
import type { Note } from './Note'
import { pedalIntervals } from './pedalIntervals'
import { readControllerEvents } from './readControllerEvents'
import { readMidiHeader } from './readMidiHeader'
import { sha256Hex } from './sha256Hex'
import type { Song } from './Song'

const SUSTAIN_PEDAL = 64

/**
 * Parses a Standard MIDI File into our Song model. Notes are grouped by channel, not track:
 * @tonejs/midi splits tracks by (program, channel), so each parsed track's `channel` holds
 * for all its notes. Known upstream quirk: a program change between a note's on and off
 * can drop that note.
 */
export async function importMidi(
  bytes: Uint8Array,
  options: { readonly fileName: string },
): Promise<Song> {
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

  const counts = new Map<number, number>()
  for (const n of notes) counts.set(n.channel, (counts.get(n.channel) ?? 0) + 1)
  const channels: ChannelInfo[] = [...counts]
    .sort((a, b) => a[0] - b[0])
    .map(([channel, noteCount]) => ({ channel, noteCount }))

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
    id: await sha256Hex(bytes),
    title: songTitle(midi, options.fileName),
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

function songTitle(midi: Midi, fileName: string): string {
  const fromFile = [midi.header.name, ...midi.tracks.map((t) => t.name)]
    .map((name) => name.trim())
    .find((name) => name !== '')
  return fromFile ?? fileName.replace(/\.[^.]+$/, '')
}
