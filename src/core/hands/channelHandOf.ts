import type { Hand } from './Hand'
import type { HandAssignment } from './HandAssignment'
import type { HandOf } from './HandOf'

/**
 * The hand from the song's channel assignment (the Library's Right / Left / Hidden per channel).
 * A channel listed under both hands goes to the right hand, so a note is never played twice.
 */
export function channelHandOf(assignment: HandAssignment): HandOf {
  const byChannel = new Map<number, Hand>()
  for (const channel of assignment.left) byChannel.set(channel, 'left')
  for (const channel of assignment.right) byChannel.set(channel, 'right')
  return (note) => byChannel.get(note.channel) ?? null
}
