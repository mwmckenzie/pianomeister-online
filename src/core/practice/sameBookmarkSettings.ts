import type { BookmarkSettings } from './BookmarkSettings'
import { sameRange } from './diffFromBookmark'

/**
 * Two bookmarks have the same settings (brief decision 69): same song, bars, tempo, right and
 * left hand modes, pre-roll beats and sound, and metronome mode. No two of a profile's bookmarks may.
 */
export function sameBookmarkSettings(a: BookmarkSettings, b: BookmarkSettings): boolean {
  const x = a.config
  const y = b.config
  return (
    a.songId === b.songId &&
    sameRange(x.loop, y.loop) &&
    x.tempoPercent === y.tempoPercent &&
    x.handAudio.right === y.handAudio.right &&
    x.handAudio.left === y.handAudio.left &&
    x.preRollBeats === y.preRollBeats &&
    x.preRollMode === y.preRollMode &&
    x.metronomeMode === y.metronomeMode
  )
}
