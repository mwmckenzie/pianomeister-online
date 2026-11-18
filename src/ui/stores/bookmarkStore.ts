import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import type { Bookmark } from '@/core/practice/Bookmark'
import { autoBookmarkName } from '@/core/practice/bookmarkNames'
import type { BookmarkEdit } from '@/core/practice/BookmarkEdit'
import type { BookmarkSettings } from '@/core/practice/BookmarkSettings'
import { editBookmark } from '@/core/practice/editBookmark'
import type { PracticeConfig } from '@/core/practice/PracticeConfig'
import { sameBookmarkSettings } from '@/core/practice/sameBookmarkSettings'
import type { LoopRange } from '@/core/transport/LoopRange'
import { Bookmarks } from '@/data/Bookmarks'

import { appDatabase } from './appDatabase'
import { useProfileStore } from './profileStore'

type SavedConfig = PracticeConfig & { readonly loop: LoopRange }

/**
 * The active profile's bookmarks (brief decision 67). Bookmarks are edited only in the
 * bookmark manager; the player only ever creates new ones ("Save as bookmark"). An auto-named
 * bookmark's name follows its settings (decision 69).
 */
export const useBookmarkStore = defineStore('bookmarks', () => {
  const service = new Bookmarks(appDatabase())
  const profiles = useProfileStore()
  const bookmarks = shallowRef<readonly Bookmark[]>([])

  const byId = computed(() => new Map(bookmarks.value.map((b) => [b.id, b])))
  const bySong = computed(() => {
    const map = new Map<string, Bookmark[]>()
    for (const b of bookmarks.value) map.set(b.songId, [...(map.get(b.songId) ?? []), b])
    return map
  })

  /** Counts edits shown before their write lands; a read that overlaps one is read again. */
  let edits = 0

  async function refresh(): Promise<void> {
    await profiles.load()
    for (;;) {
      const seen = edits
      const rows = await service.forProfile(profiles.activeId)
      // An edit made while reading may be missing from `rows`; reading again (queued after its
      // write) keeps it from being overwritten.
      if (seen === edits) {
        bookmarks.value = rows
        return
      }
    }
  }

  // Loaded on first use, and again for each profile.
  watch(
    () => profiles.activeId,
    () => void refresh(),
    { immediate: true },
  )

  function forSong(songId: string): readonly Bookmark[] {
    return bySong.value.get(songId) ?? []
  }

  /**
   * Saves a new bookmark, auto-named unless a name is given. `id` keeps a bookmark manager
   * draft's id when it's saved, so it stays selected.
   */
  async function create(
    songId: string,
    config: SavedConfig,
    options: { readonly id?: string; readonly name?: string } = {},
  ): Promise<Bookmark> {
    await profiles.load()
    const now = Date.now()
    const name = options.name?.trim() ?? ''
    const bookmark: Bookmark = {
      id: options.id ?? crypto.randomUUID(),
      profileId: profiles.activeId,
      songId,
      name: name === '' ? autoBookmarkName(config) : name,
      autoName: name === '',
      config,
      createdAt: now,
      updatedAt: now,
    }
    await service.put(bookmark)
    await refresh()
    return bookmark
  }

  /** Applies one manager edit (see editBookmark); shown at once, written after. */
  async function update(id: string, edit: BookmarkEdit): Promise<void> {
    const current = byId.value.get(id)
    if (current === undefined) return
    const next = editBookmark(current, edit, Date.now())
    edits++
    bookmarks.value = bookmarks.value.map((b) => (b.id === id ? next : b))
    await service.put(next)
  }

  /** The profile's bookmark with these settings (brief decision 69: no two are the same). */
  function findSame(settings: BookmarkSettings, exceptId?: string): Bookmark | null {
    return (
      bookmarks.value.find((b) => b.id !== exceptId && sameBookmarkSettings(b, settings)) ?? null
    )
  }

  /** Deletes a bookmark and returns it, so Undo can put it back as it was. */
  async function remove(id: string): Promise<Bookmark | null> {
    const removed = byId.value.get(id) ?? null
    await service.delete(id)
    await refresh()
    return removed
  }

  async function restore(bookmark: Bookmark): Promise<void> {
    await service.put(bookmark)
    await refresh()
  }

  /** Bookmarks per profile id (every profile, for the Profiles tab). */
  function countByProfile(): Promise<Map<string, number>> {
    return service.countByProfile()
  }

  return {
    bookmarks,
    byId,
    bySong,
    countByProfile,
    refresh,
    forSong,
    create,
    update,
    findSame,
    remove,
    restore,
  }
})
