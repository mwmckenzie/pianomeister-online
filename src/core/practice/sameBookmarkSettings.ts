import { sameRange } from './diffFromBookmark'
import type { PracticeConfig } from './PracticeConfig'

/** A song with a setup: a bookmark, Full song, or what the player has now. */
interface SongSetup {
  readonly songId: string
  readonly config: PracticeConfig
}

/**
 * Two setups are the same (brief decisions 69, 78): same song, bars (or both the whole song),
 * tempo, right and left hand modes, pre-roll beats and sound, and metronome mode. No two of a
 * profile's bookmarks may be; the now-playing line shows a bookmark when the player's setup is.
 */
export function sameBookmarkSettings(a: SongSetup, b: SongSetup): boolean {
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
