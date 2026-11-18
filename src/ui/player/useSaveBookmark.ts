import { useRouter } from 'vue-router'

import { useBookmarkStore } from '../stores/bookmarkStore'
import { useLibraryStore } from '../stores/libraryStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useToastStore } from '../stores/toastStore'

/**
 * "Save as bookmark" (the save icon, B, or the loop popover; brief decision 69): one click saves
 * what's playing — song, loop (or the whole song), tempo, hand modes, pre-roll — auto-named,
 * and loads it. Nothing audible changes. If the profile already has a bookmark with these
 * settings, nothing is created: that one is loaded instead.
 */
export function useSaveBookmark(): () => Promise<void> {
  const practice = usePracticeStore()
  const bookmarks = useBookmarkStore()
  const library = useLibraryStore()
  const toasts = useToastStore()
  const router = useRouter()

  const openManager = (bookmarkId: string, focus?: 'name') =>
    void router.push({
      name: 'bookmarks',
      query: focus === undefined ? { bookmark: bookmarkId } : { bookmark: bookmarkId, focus },
    })

  return async function saveAsBookmark(): Promise<void> {
    const songId = practice.songId
    if (songId === null) return
    const { first, last } = practice.bars
    const current = practice.current
    const config = { ...current, loop: current.loop ?? { startBar: first, endBar: last } }

    const same = bookmarks.findSame({ songId, config })
    if (same !== null) {
      // Same settings: what's playing already is that bookmark, so nothing jumps.
      practice.load(songId, same.id, practice.bars, { jump: false })
      void library.setLastOpened(songId, same.id)
      toasts.showActions(`Already saved as “${same.name}” · no new bookmark created`, [
        { label: 'Show', run: () => openManager(same.id) },
      ])
      return
    }

    const before = practice.snapshot()
    try {
      const created = await bookmarks.create(songId, config)
      practice.load(songId, created.id, practice.bars, { jump: false })
      void library.setLastOpened(songId, created.id)
      toasts.showUndo(
        `Saved “${created.name}”`,
        () => {
          void bookmarks.remove(created.id).then(() => {
            if (practice.bookmarkId !== created.id) return
            practice.restore(before)
            void library.setLastOpened(songId, before.bookmarkId)
          })
        },
        [{ label: 'Rename', run: () => openManager(created.id, 'name') }],
      )
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      toasts.show(`Couldn't save the bookmark: ${reason}`, 'error')
    }
  }
}
