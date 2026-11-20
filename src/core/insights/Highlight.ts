/**
 * One of Welcome's rotating highlights (m7-7 decision 9). The title is in parts so the numbers
 * can be accented ("B section went from **70%** to **85%** this month").
 */
export interface Highlight {
  readonly kind: 'tempo' | 'milestone' | 'favouriteSong' | 'topBookmark' | 'longestSession'
  readonly title: readonly { readonly text: string; readonly accent?: boolean }[]
  readonly detail: string
  /** A small trend line (tempo highlights): values oldest first. */
  readonly trend?: readonly number[]
}
