import type { Bookmark } from './Bookmark'
import { bookmarkSummary } from './bookmarkSummary'
import { clampRange } from './clampRange'
import { fullSongId } from './fullSongId'
import type { NowPlayingInfo } from './NowPlayingInfo'
import type { PracticeConfig } from './PracticeConfig'
import { sameBookmarkSettings } from './sameBookmarkSettings'

/**
 * What the current setup is (brief decisions 68–70), live — not what was last loaded:
 *
 * - a bookmark of the song whose settings it matches exactly (its range clamped to the song, as
 *   on load): that bookmark, whichever was loaded ("adoption");
 * - Full song when there's no loop, the tempo is 100% and hand modes, pre-roll and metronome
 *   equal the global settings (`fullSong`);
 * - otherwise a custom setup, labelled like an automatic bookmark name ("Bars 20–35 · 100% ·
 *   both hands · quiet pre-roll 2"; "Full song · 85% · …" without a loop).
 */
export function nowPlaying(
  songId: string,
  setup: PracticeConfig,
  bookmarks: readonly Bookmark[],
  fullSong: PracticeConfig,
  bars: { readonly first: number; readonly last: number },
): NowPlayingInfo {
  const current = { songId, config: setup }
  const match = bookmarks.find(
    (b) =>
      b.songId === songId &&
      sameBookmarkSettings(current, {
        songId,
        config: { ...b.config, loop: clampRange(b.config.loop, bars.first, bars.last) },
      }),
  )
  if (match !== undefined) {
    return { kind: 'bookmark', bookmark: match, entryId: match.id, label: match.name }
  }
  if (sameBookmarkSettings(current, { songId, config: fullSong })) {
    return { kind: 'fullSong', entryId: fullSongId(songId), label: 'Full song' }
  }
  return {
    kind: 'custom',
    entryId: null,
    label: bookmarkSummary(setup, bars.last, { allParts: true, wholeSong: 'Full song' }),
  }
}
