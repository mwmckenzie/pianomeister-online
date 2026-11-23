/**
 * Milliseconds until the gap since the last playback passes (the idle timer), or null when
 * there was no playback to time from (it's then decided on load and refocus).
 */
export function homeCheckDelay(
  now: number,
  lastPlaybackEnd: number | null,
  gapMs: number,
): number | null {
  if (lastPlaybackEnd === null) return null
  return Math.max(0, lastPlaybackEnd + gapMs - now) + 1
}
