import type { Bookmark } from '../practice/Bookmark'
import type { PlayRecord } from '../stats/PlayRecord'
import type { Suggestion } from './Suggestion'

const DAY = 86_400_000
/** A bookmark counts as resting after this long without play. */
const RESTING_DAYS = 7

/**
 * Welcome's "Maybe next" (m7-7 decision 10), at most two: the most practised bookmark not played
 * for 7 days or more, and the first song (in library order) never played — other than
 * `exceptSongId`, the one the resume card already offers.
 */
export function pickSuggestions(input: {
  readonly records: readonly PlayRecord[]
  readonly bookmarks: readonly Bookmark[]
  readonly songs: readonly { readonly songId: string; readonly title: string }[]
  readonly now: number
  readonly exceptSongId?: string
}): readonly Suggestion[] {
  const out: Suggestion[] = []
  const byBookmark = new Map<string, { ms: number; last: number }>()
  for (const r of input.records) {
    if (r.bookmarkId === null) continue
    const t = byBookmark.get(r.bookmarkId) ?? { ms: 0, last: 0 }
    byBookmark.set(r.bookmarkId, {
      ms: t.ms + r.playedMs,
      last: Math.max(t.last, r.startedAt + r.playedMs),
    })
  }
  const resting = input.bookmarks
    .map((bookmark) => ({ bookmark, totals: byBookmark.get(bookmark.id) }))
    .filter((x) => x.totals !== undefined && input.now - x.totals.last >= RESTING_DAYS * DAY)
    .sort((a, b) => (b.totals?.ms ?? 0) - (a.totals?.ms ?? 0))[0]
  if (resting !== undefined) {
    out.push({
      kind: 'bookmark',
      bookmark: resting.bookmark,
      songTitle: input.songs.find((s) => s.songId === resting.bookmark.songId)?.title ?? '',
      lastPlayedAt: resting.totals?.last ?? 0,
    })
  }
  const played = new Set(input.records.map((r) => r.songId))
  const fresh = input.songs.find((s) => !played.has(s.songId) && s.songId !== input.exceptSongId)
  if (fresh !== undefined) out.push({ kind: 'song', songId: fresh.songId, title: fresh.title })
  return out
}
