import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import type { Playlist } from '@/core/playlists/Playlist'
import { Playlists } from '@/data/Playlists'

import { appDatabase } from './appDatabase'
import { useProfileStore } from './profileStore'

/**
 * The active profile's playlists (milestone 9.5), oldest first. Every change is written at once;
 * the list follows the profile.
 */
export const usePlaylistStore = defineStore('playlists', () => {
  const profiles = useProfileStore()
  const playlists = shallowRef<readonly Playlist[]>([])
  const loaded = shallowRef(false)
  const repository = () => new Playlists(appDatabase(), profiles.activeId)

  async function refresh(): Promise<void> {
    await profiles.load()
    playlists.value = await repository().list()
    loaded.value = true
  }

  const byId = computed(() => new Map(playlists.value.map((p) => [p.id, p])))

  /** Adds or replaces one, stamping `updatedAt`. */
  async function save(playlist: Playlist, now = new Date().toISOString()): Promise<Playlist> {
    const stamped = { ...playlist, updatedAt: now }
    await repository().put(stamped)
    const rest = playlists.value.filter((p) => p.id !== stamped.id)
    playlists.value = [...rest, stamped].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return stamped
  }

  async function remove(id: string): Promise<void> {
    await repository().delete(id)
    playlists.value = playlists.value.filter((p) => p.id !== id)
  }

  /** Adds imported playlists (already merged: ids and names unique). */
  async function addAll(added: readonly Playlist[]): Promise<void> {
    await repository().bulkAdd(added)
    await refresh()
  }

  /** Every profile's playlists, for an import's id checks. */
  function all(): Promise<Playlist[]> {
    return repository().all()
  }

  /** Listening remembers one thing (milestone 9.5 E3): when a playlist was last played. */
  async function markPlayed(id: string, at = Date.now()): Promise<void> {
    const playlist = byId.value.get(id)
    if (playlist === undefined) return
    const next = { ...playlist, lastPlayedAt: at }
    await repository().put(next)
    playlists.value = playlists.value.map((p) => (p.id === id ? next : p))
  }

  watch(
    () => profiles.activeId,
    () => void refresh(),
  )

  return { playlists, loaded, byId, refresh, save, remove, addAll, all, markPlayed }
})
