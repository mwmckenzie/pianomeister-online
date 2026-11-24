import { isChannelEvent, type MidiEvent } from '../midi/MidiEvent'
import { META_TRACK_NAME, type MidiFile } from '../midi/MidiFile'
import type { HandLetter } from './HandLetter'
import type { RawNote } from './RawNote'
import { voiceId } from './voiceId'

export interface HandExportOptions {
  readonly rightChannel: number
  readonly leftChannel: number
  /** Same tracks, or two new tracks "Right Hand" and "Left Hand". */
  readonly layout: 'inPlace' | 'twoTracks'
}

/**
 * Moves the assigned notes to the hands' channels (HD brief §8). Channel-wide events of an
 * affected voice (program, controllers such as sustain, pitch bend, aftertouch) go to every hand
 * the voice feeds, so both keep the instrument and the pedalling. Notes that aren't assigned stay
 * as they are.
 */
export function applyHandAssignment(
  file: MidiFile,
  notes: readonly RawNote[],
  hands: ReadonlyMap<string, HandLetter>,
  options: HandExportOptions,
): MidiFile {
  const channelOf = (hand: HandLetter) =>
    hand === 'R' ? options.rightChannel : options.leftChannel
  /** Per track: note event index → hand. */
  const handAt = file.tracks.map(() => new Map<number, HandLetter>())
  const used = new Map<string, Set<HandLetter>>()
  for (const n of notes) {
    const hand = hands.get(n.id)
    if (hand === undefined) continue
    handAt[n.track]?.set(n.onIndex, hand)
    if (n.offIndex >= 0) handAt[n.track]?.set(n.offIndex, hand)
    used.set(voiceId(n), (used.get(voiceId(n)) ?? new Set()).add(hand))
  }
  const handsOf = (track: number, e: MidiEvent) =>
    isChannelEvent(e) ? used.get(voiceId({ track, channel: e.channel })) : undefined
  /** Where an event of an affected voice goes; a stray note event goes right. */
  const targets = (track: number, index: number, e: MidiEvent, feeds: Set<HandLetter>) => {
    const hand = handAt[track]?.get(index)
    if (hand !== undefined) return [hand]
    if (e.kind === 'noteOn' || e.kind === 'noteOff') return ['R'] as const
    return (['R', 'L'] as const).filter((h) => feeds.has(h))
  }
  const moved = (e: MidiEvent, hand: HandLetter): MidiEvent =>
    isChannelEvent(e) ? { ...e, channel: channelOf(hand) } : e

  if (options.layout === 'inPlace') {
    const tracks = file.tracks.map((t, track) => ({
      events: t.events.flatMap((e, i) => {
        const feeds = handsOf(track, e)
        if (feeds === undefined) return [e]
        const to = targets(track, i, e, feeds)
        // Both hands on one channel: the event once.
        const distinct = to.filter(
          (h, n) => to.findIndex((x) => channelOf(x) === channelOf(h)) === n,
        )
        return distinct.map((h) => moved(e, h))
      }),
    }))
    return { ...file, tracks }
  }

  // Tracks are chosen by hand, not channel, so equal channels still give two tracks.
  const out: Record<HandLetter, MidiEvent[]> = { R: [], L: [] }
  const tracks = file.tracks.map((t, track) => ({
    events: t.events.filter((e, i) => {
      const feeds = handsOf(track, e)
      if (feeds === undefined) return true
      for (const hand of targets(track, i, e, feeds)) out[hand].push(moved(e, hand))
      return false
    }),
  }))
  const handTrack = (name: string, events: MidiEvent[]) => ({
    events: [
      { kind: 'meta', tick: 0, metaType: META_TRACK_NAME, data: new TextEncoder().encode(name) },
      ...events.sort((a, b) => a.tick - b.tick),
    ] satisfies MidiEvent[],
  })
  return {
    ...file,
    format: 1,
    tracks: [...tracks, handTrack('Right Hand', out.R), handTrack('Left Hand', out.L)],
  }
}
