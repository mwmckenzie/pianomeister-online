/** A voice is a (track, channel) pair: the unit classified as a hand. */
export function voiceId(note: { readonly track: number; readonly channel: number }): string {
  return `${note.track}:${note.channel}`
}
