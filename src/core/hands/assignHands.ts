import type { Note } from '../song/Note'
import type { Hand } from './Hand'
import type { HandAssignment } from './HandAssignment'
import type { HandNote } from './HandNote'

/**
 * Tags notes with their hand. Channels assigned to neither hand are dropped (hidden and silent).
 * A channel listed under both hands goes to the right hand, so a note is never played twice.
 */
export function assignHands(notes: readonly Note[], assignment: HandAssignment): HandNote[] {
  const handByChannel = new Map<number, Hand>()
  for (const channel of assignment.left) handByChannel.set(channel, 'left')
  for (const channel of assignment.right) handByChannel.set(channel, 'right')

  const out: HandNote[] = []
  for (const note of notes) {
    const hand = handByChannel.get(note.channel)
    if (hand !== undefined) out.push({ ...note, hand })
  }
  return out
}
