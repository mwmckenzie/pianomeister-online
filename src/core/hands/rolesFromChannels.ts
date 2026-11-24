import type { HandAssignment } from './HandAssignment'
import type { VoiceRole } from './HandSettings'

/** A channel map as voice roles: every voice on a channel gets the channel's role. */
export function rolesFromChannels(
  voices: readonly { readonly id: string; readonly channel: number }[],
  hands: HandAssignment,
): Record<string, VoiceRole> {
  const roles: Record<string, VoiceRole> = {}
  for (const { id, channel } of voices) {
    // A channel in both lists plays in the right hand, as channelHandOf does.
    if (hands.right.includes(channel)) roles[id] = 'right'
    else roles[id] = hands.left.includes(channel) ? 'left' : 'hidden'
  }
  return roles
}
