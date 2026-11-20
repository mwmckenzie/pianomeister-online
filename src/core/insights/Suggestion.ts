import type { Bookmark } from '../practice/Bookmark'

/** A "Maybe next" chip on Welcome (m7-7 decision 10). */
export type Suggestion =
  | {
      readonly kind: 'bookmark'
      readonly bookmark: Bookmark
      readonly songTitle: string
      readonly lastPlayedAt: number
    }
  | { readonly kind: 'song'; readonly songId: string; readonly title: string }
