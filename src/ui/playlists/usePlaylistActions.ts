import { useRouter } from 'vue-router'

import type { Playlist } from '@/core/playlists/Playlist'
import { newPlaylist } from '@/core/playlists/newPlaylist'

import { useListeningStore } from '../stores/listeningStore'
import { usePlaylistStore } from '../stores/playlistStore'
import { useProfileStore } from '../stores/profileStore'
import { useToastStore } from '../stores/toastStore'

/**
 * Playlist actions used from several places (milestone 9.5): the Playlists tab, "Add to
 * playlist…" in the Library and the song picker, and the Welcome "Listen" card.
 */
export function usePlaylistActions() {
  const store = usePlaylistStore()
  const profiles = useProfileStore()
  const listening = useListeningStore()
  const toasts = useToastStore()
  const router = useRouter()

  /** A new playlist (holding `songIds`), saved; returns it. */
  async function create(songIds: readonly string[] = [], name = 'New playlist'): Promise<Playlist> {
    if (!store.loaded) await store.refresh()
    const now = new Date().toISOString()
    const playlist = newPlaylist(
      profiles.activeId,
      name,
      store.playlists,
      crypto.randomUUID(),
      now,
      songIds,
    )
    return store.save(playlist, now)
  }

  /** Appends a song (it may already be there: songs can repeat); `toast` says where it went. */
  async function addSong(playlistId: string, songId: string, toast = true): Promise<void> {
    const playlist = store.byId.get(playlistId)
    if (playlist === undefined) return
    await store.save({ ...playlist, entries: [...playlist.entries, { songId, lookId: null }] })
    if (toast) {
      toasts.showActions(`Added to “${playlist.name}”`, [
        {
          label: 'Open',
          run: () => void router.push({ name: 'playlists', query: { playlist: playlistId } }),
        },
      ])
    }
  }

  /** "New playlist…" from a song: makes one holding it and opens it with its name to edit. */
  async function createWithSong(songId: string): Promise<void> {
    const playlist = await create([songId])
    await router.push({ name: 'playlists', query: { playlist: playlist.id, focus: 'name' } })
  }

  /** Plays a playlist from entry `start`: the player picks the request up (listening). */
  async function play(playlistId: string, start = 0): Promise<void> {
    listening.requestPlay(playlistId, start)
    await router.push({ name: 'player' })
  }

  return { create, addSong, createWithSong, play }
}
