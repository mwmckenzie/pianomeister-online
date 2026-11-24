import type { MidiFile } from '../midi/MidiFile'
import type { RawNote } from './RawNote'

/**
 * Pairs note-ons with note-offs per track (HD brief §4.1): overlapping notes of one pitch and
 * channel close first in, first out; a note never released ends at the track's last tick.
 * Sorted by start, then pitch.
 */
export function extractNotes(file: MidiFile): RawNote[] {
  const notes: RawNote[] = []
  file.tracks.forEach(({ events }, track) => {
    const open = new Map<number, { index: number; note: RawNote }[]>()
    let lastTick = 0
    events.forEach((e, i) => {
      lastTick = Math.max(lastTick, e.tick)
      if (e.kind !== 'noteOn' && e.kind !== 'noteOff') return
      const key = e.channel * 128 + e.note
      if (e.kind === 'noteOn' && e.velocity > 0) {
        const note: RawNote = {
          id: `${track}:${i}`,
          track,
          channel: e.channel,
          midi: e.note,
          velocity: e.velocity,
          startTick: e.tick,
          endTick: e.tick,
          onIndex: i,
          offIndex: -1,
        }
        const queue = open.get(key)
        const entry = { index: notes.length, note }
        if (queue === undefined) open.set(key, [entry])
        else queue.push(entry)
        notes.push(note)
      } else {
        const entry = open.get(key)?.shift()
        if (entry !== undefined) {
          notes[entry.index] = { ...entry.note, endTick: e.tick, offIndex: i }
        }
      }
    })
    for (const queue of open.values()) {
      for (const { index, note } of queue) {
        notes[index] = { ...note, endTick: Math.max(note.startTick + 1, lastTick) }
      }
    }
  })
  return notes.sort((a, b) => a.startTick - b.startTick || a.midi - b.midi)
}
