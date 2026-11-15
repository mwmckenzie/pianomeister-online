import type { Note } from '../song/Note'
import type { PedalInterval } from '../song/PedalInterval'
import type { SoundingNote } from './SoundingNote'

/**
 * Sound-only sustain: a note released while its channel's pedal is down rings until the pedal
 * comes up, but never past the next onset of the same pitch on the same channel (re-striking
 * a key under the pedal cuts the previous sound, as on a real piano).
 */
export function applySustain(
  notes: readonly Note[],
  pedals: readonly PedalInterval[],
): SoundingNote[] {
  const pedalsByChannel = new Map<number, PedalInterval[]>()
  for (const p of pedals) {
    const list = pedalsByChannel.get(p.channel) ?? []
    list.push(p)
    pedalsByChannel.set(p.channel, list)
  }
  for (const list of pedalsByChannel.values()) list.sort((a, b) => a.startTick - b.startTick)

  // Next onset of the same pitch on the same channel, found by walking each key's notes in order.
  const nextOnset = new Map<Note, number>()
  const byKey = new Map<string, Note[]>()
  for (const n of notes) {
    const key = `${n.channel}:${n.midi}`
    const list = byKey.get(key) ?? []
    list.push(n)
    byKey.set(key, list)
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => a.startTick - b.startTick)
    for (let i = 0; i < list.length - 1; i++) {
      nextOnset.set(list[i] as Note, (list[i + 1] as Note).startTick)
    }
  }

  return notes.map((n) => {
    let soundEndTick = n.endTick
    // A pedal pressed exactly at the release tick still catches the note.
    const held = pedalsByChannel
      .get(n.channel)
      ?.find((p) => p.startTick <= n.endTick && n.endTick < p.endTick)
    if (held !== undefined) soundEndTick = held.endTick
    const cut = nextOnset.get(n)
    if (cut !== undefined && cut < soundEndTick) soundEndTick = Math.max(n.endTick, cut)
    return { ...n, soundEndTick }
  })
}
