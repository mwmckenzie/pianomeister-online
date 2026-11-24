import { songStartTimes } from './songStartTimes'

/**
 * Where the next song starts (timeline seconds) after the current one: its usual place
 * (songStartTimes), unless that is already past `at` (a song ready late, or a seek into the
 * crossfade); then `leadSec` ahead, so its first notes can still be scheduled (`late`).
 */
export function placeNextSong(
  current: { readonly startSec: number; readonly durationSec: number },
  nextDurationSec: number,
  crossfadeSec: number,
  at: number,
  leadSec: number,
): { readonly startSec: number; readonly late: boolean } {
  const [, offset] = songStartTimes([current.durationSec, nextDurationSec], crossfadeSec)
  const usual = current.startSec + (offset ?? current.durationSec)
  const earliest = at + leadSec
  return usual < earliest ? { startSec: earliest, late: true } : { startSec: usual, late: false }
}
