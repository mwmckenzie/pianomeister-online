import type { Bookmark } from '../practice/Bookmark'
import type { PlayRecord } from '../stats/PlayRecord'

/** What Welcome's highlights are picked from. */
export interface HighlightInput {
  readonly records: readonly PlayRecord[]
  readonly bookmarks: readonly Bookmark[]
  readonly songTitle: (songId: string) => string
  readonly now: number
  readonly weekStart: number
  readonly timeZone?: string
  /** The "New session after" setting, in ms (default 30 min). */
  readonly gapMs?: number
}
