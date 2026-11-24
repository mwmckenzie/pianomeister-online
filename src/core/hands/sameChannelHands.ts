import type { HandAssignment } from './HandAssignment'

/** Whether two channel maps give every channel that has notes the same hand. */
export function sameChannelHands(
  channels: readonly { readonly channel: number }[],
  a: HandAssignment,
  b: HandAssignment,
): boolean {
  const hand = (map: HandAssignment, channel: number) =>
    map.right.includes(channel) ? 'right' : map.left.includes(channel) ? 'left' : null
  return channels.every(({ channel }) => hand(a, channel) === hand(b, channel))
}
