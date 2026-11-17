import type { ChannelInfo } from '../song/ChannelInfo'
import type { HandAssignment } from './HandAssignment'
import type { HandNoteSummary } from './HandNoteSummary'

/**
 * Notes per hand and the pitch range of the notes that play, for the picker. A channel in both
 * hand lists counts for the right hand, as in assignHands; hidden channels don't count.
 */
export function summariseHandNotes(
  channels: readonly ChannelInfo[],
  hands: HandAssignment,
): HandNoteSummary {
  let right = 0
  let left = 0
  let lowest = Infinity
  let highest = -Infinity
  for (const c of channels) {
    if (c.noteCount === 0) continue
    if (hands.right.includes(c.channel)) right += c.noteCount
    else if (hands.left.includes(c.channel)) left += c.noteCount
    else continue
    lowest = Math.min(lowest, c.minPitch)
    highest = Math.max(highest, c.maxPitch)
  }
  return {
    right,
    left,
    lowest: Number.isFinite(lowest) ? lowest : null,
    highest: Number.isFinite(highest) ? highest : null,
  }
}
