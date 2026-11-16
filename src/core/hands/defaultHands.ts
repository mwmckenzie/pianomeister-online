import type { ChannelInfo } from '../song/ChannelInfo'
import { DEFAULT_HAND_ASSIGNMENT, type HandAssignment } from './HandAssignment'

/**
 * Channel 0 = right, 1 = left when either has notes. Otherwise by average pitch: the highest
 * channel plays the right hand, the next the left; the rest are hidden.
 */
export function defaultHands(channels: readonly ChannelInfo[]): HandAssignment {
  if (channels.some((c) => c.channel === 0 || c.channel === 1)) return DEFAULT_HAND_ASSIGNMENT
  const byPitch = [...channels].sort(
    (a, b) => b.averagePitch - a.averagePitch || a.channel - b.channel,
  )
  const [right, left] = byPitch
  return {
    right: right === undefined ? [] : [right.channel],
    left: left === undefined ? [] : [left.channel],
  }
}
