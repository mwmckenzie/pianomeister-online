import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'

import type { PlaylistRepeat } from '@/core/playlists/PlaylistRepeat'

/** A song as the listening HUD names it. */
export interface ListeningSong {
  readonly songId: string
  readonly title: string
  readonly composer: string
  readonly durationSec: number
}

/** What the listening HUD shows each frame (song-local: bars restart per song). */
export interface ListeningClock {
  readonly bar: number
  readonly beat: number
  /** Beats in the current bar (the beat dots). */
  readonly beats: number
  readonly bpm: number
  /** Seconds into the current song and its length. */
  readonly elapsedSec: number
  readonly durationSec: number
  readonly playing: boolean
}

/**
 * Listening mode's state for the UI (milestone 9.5 C): what's playing, what's next, the play
 * order's position and the session's own tempo and mute. The ListeningController in the player
 * writes it; Play buttons elsewhere (Playlists tab, Welcome) ask for listening with `request`.
 */
export const useListeningStore = defineStore('listening', () => {
  const active = ref(false)
  const playlistId = ref<string | null>(null)
  const playlistName = ref('')
  /** 1-based position in the play order, and the order's length. */
  const position = ref(0)
  const total = ref(0)
  const current = shallowRef<ListeningSong | null>(null)
  const upNext = shallowRef<ListeningSong | null>(null)
  const shuffle = ref(false)
  const repeat = ref<PlaylistRepeat>('playlist')
  const muted = ref(false)
  const tempoPercent = ref(100)
  /** Repeat off, after the last song: paused, "Playlist finished · Play again". */
  const finished = ref(false)
  /** Bumped when a new song starts (the seam crossed the now line): the announcement shows. */
  const announced = ref(0)
  const clock = shallowRef<ListeningClock | null>(null)
  /** The playlist's saved look the current song shows, if any ("Update playlist look"). */
  const playlistLook = ref<string | null>(null)
  /** A Play elsewhere: the player starts listening when it sees this. */
  const request = shallowRef<{ readonly playlistId: string; readonly start: number } | null>(null)

  function requestPlay(id: string, start = 0): void {
    request.value = { playlistId: id, start }
  }

  return {
    active,
    playlistId,
    playlistName,
    position,
    total,
    current,
    upNext,
    shuffle,
    repeat,
    muted,
    tempoPercent,
    finished,
    announced,
    clock,
    playlistLook,
    request,
    requestPlay,
  }
})
