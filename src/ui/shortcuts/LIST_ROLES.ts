/**
 * Which list each list key drives, page by page (brief decision 90): the main list is the one
 * you choose from (it drives the details and Enter); the side list filters or refines it.
 */
export const LIST_ROLES: readonly {
  readonly page: string
  readonly main: string
  readonly side: string
  readonly open: string
}[] = [
  { page: 'Song picker', main: 'Songs', side: 'Load list (Full song, bookmarks)', open: 'Load' },
  { page: 'Library', main: 'Songs', side: 'Filters (All songs, sources, tags)', open: 'Play' },
  { page: 'Bookmark manager', main: 'Bookmarks', side: 'Song filter', open: 'Load in player' },
]
