import type { ChannelInfo } from './ChannelInfo'
import type { Note } from './Note'

/** Note count, range and mean pitch of every channel with notes, by channel. */
export function summariseChannels(notes: readonly Note[]): ChannelInfo[] {
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
