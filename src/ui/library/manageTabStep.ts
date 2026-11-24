/** The Manage tabs in order (Library | Bookmarks | Playlists); Tab keys wrap around them. */
const MANAGE_TABS = ['library', 'bookmarks', 'playlists'] as const

export type ManageTab = (typeof MANAGE_TABS)[number]

/** The tab `by` steps from `from`, wrapping. */
export function manageTabStep(from: ManageTab, by: 1 | -1): ManageTab {
  const at = MANAGE_TABS.indexOf(from)
  return MANAGE_TABS[(at + by + MANAGE_TABS.length) % MANAGE_TABS.length] ?? 'library'
}
