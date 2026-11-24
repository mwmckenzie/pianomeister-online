/** The background pass's toast; null when there's nothing to say. */
export function handsPassMessage(detected: number, toCheck: number): string | null {
  if (detected === 0) return null
  return `Hands detected for ${detected} ${detected === 1 ? 'song' : 'songs'} · ${toCheck} to check`
}
