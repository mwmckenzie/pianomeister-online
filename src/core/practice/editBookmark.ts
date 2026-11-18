import type { Bookmark } from './Bookmark'
import type { BookmarkEdit } from './BookmarkEdit'
import { autoBookmarkName } from './bookmarkNames'

/**
 * A bookmark with one edit applied (brief decision 69): typing a name makes it custom (an empty
 * one keeps the old name); the reset makes it automatic again; an automatic name follows the
 * settings.
 */
export function editBookmark(bookmark: Bookmark, edit: BookmarkEdit, now: number): Bookmark {
  const config = edit.config ?? bookmark.config
  const autoName = edit.autoName ?? (edit.name === undefined ? bookmark.autoName : false)
  const typed = edit.name?.trim() ?? ''
  const name = autoName ? autoBookmarkName(config) : typed === '' ? bookmark.name : typed
  return { ...bookmark, config, autoName, name, updatedAt: now }
}
