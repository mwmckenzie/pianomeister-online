import type { HomeCheck } from './HomeCheck'
import { isNewSession } from './isNewSession'

/**
 * Whether a new session has begun since Home was last opened for one: the session rule says so
 * (isNewSession) and Home hasn't been opened since that playback ended, so it opens at most
 * once per gap, on load, refocus or the idle timer alike. Whether it may interrupt (playback, an
 * unsaved draft) is the caller's: a blocked check still counts as handled.
 */
export function shouldOpenHome(check: HomeCheck): boolean {
  const { now, lastPlaybackEnd, lastAutoOpen, gapMs } = check
  // Never played: no session to follow (a first run starts where "Start on" says).
  if (lastPlaybackEnd === null || !isNewSession(lastPlaybackEnd, now, gapMs)) return false
  return lastAutoOpen === null || lastAutoOpen < lastPlaybackEnd
}
