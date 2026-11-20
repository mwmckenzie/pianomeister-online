import { useRouter } from 'vue-router'

import type { LoopRange } from '@/core/transport/LoopRange'

import { useBookmarkStore } from '../stores/bookmarkStore'
import { usePracticeStore } from '../stores/practiceStore'
import { useToastStore } from '../stores/toastStore'

/**
 * "Save as bookmark" from an overview selection (brief decision 103): the selected bars with
 * the current tempo, hand modes, pre-roll and metronome mode, auto-named, and **not loaded** —
 * playback carries on. The toast offers Load, Rename and Undo; settings the profile already
 * has create nothing ("Already saved as …" with Show).
 */
export function useSaveSelection(
  load: (bookmarkId: string) => void,
): (range: LoopRange) => Promise<void> {
  const practice = usePracticeStore()
  const bookmarks = useBookmarkStore()
  const toasts = useToastStore()
  const router = useRouter()

  const openManager = (bookmarkId: string, focus?: 'name') =>
    void router.push({
      name: 'bookmarks',
      query: focus === undefined ? { bookmark: bookmarkId } : { bookmark: bookmarkId, focus },
    })

  return async function saveSelection(range: LoopRange): Promise<void> {
    const songId = practice.songId
    if (songId === null) return
    const config = { ...practice.current, loop: range }
    const same = bookmarks.findSame({ songId, config })
    if (same !== null) {
      toasts.showActions(`Already saved as “${same.name}” · no new bookmark created`, [
        { label: 'Show', run: () => openManager(same.id) },
      ])
      return
    }
    try {
      const created = await bookmarks.create(songId, config)
      toasts.showUndo(`Saved “${created.name}”`, () => void bookmarks.remove(created.id), [
        { label: 'Load', run: () => load(created.id) },
        { label: 'Rename', run: () => openManager(created.id, 'name') },
      ])
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      toasts.show(`Couldn't save the bookmark: ${reason}`, 'error')
    }
  }
}
