/**
 * The one session rule, for the stats and for Home (brief decision 5, milestone 9.2): playback
 * at `now` starts a new session when there was none before, or when at least the gap passed
 * since the last playback ended. A reload or a new tab within the gap continues the session.
 */
export function isNewSession(lastPlaybackEnd: number | null, now: number, gapMs: number): boolean {
  return lastPlaybackEnd === null || now - lastPlaybackEnd > gapMs
}
