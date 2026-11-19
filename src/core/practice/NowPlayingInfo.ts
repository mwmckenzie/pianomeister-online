import type { Bookmark } from './Bookmark'

/**
 * What the player is practising right now (brief decision 69): a bookmark or Full song when the
 * setup matches it exactly, else a custom setup. `entryId` is what plays and time go to (a
 * bookmark id, `full:<songId>`, or null for other setups); `label` is what the HUD shows.
 */
export type NowPlayingInfo =
  | {
      readonly kind: 'bookmark'
      readonly bookmark: Bookmark
      readonly entryId: string
      readonly label: string
    }
  | { readonly kind: 'fullSong'; readonly entryId: string; readonly label: string }
  | { readonly kind: 'custom'; readonly entryId: null; readonly label: string }
