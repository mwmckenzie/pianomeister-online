import type { InjectionKey, Ref } from 'vue'

import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { Playlist } from '@/core/playlists/Playlist'
import type { LoopRange } from '@/core/transport/LoopRange'
import type { OpenedSong } from '@/data/OpenedSong'
import type { Engine } from '@/engine/Engine'

import type { LoadedSong } from '../playback/LoadedSong'
import type { PlaybackSession } from '../playback/PlaybackSession'

/**
 * What the benchmark (milestone 11) drives: the real player, between begin() and end(). Nothing
 * done in between is stored, and end() puts the player back.
 */
export interface BenchHost {
  /** Samples are loaded: the player can play. */
  readonly ready: Readonly<Ref<boolean>>
  engine(): Engine | null
  session(): PlaybackSession | null
  begin(): void
  end(): Promise<void>
  /** A song already loaded into the session, shown. */
  show(song: LoadedSong): void
  setLoop(range: LoopRange | null): void
  openSong(songId: string): Promise<OpenedSong>
  entry(songId: string): LibraryEntry | undefined
  entries(): Promise<readonly LibraryEntry[]>
  /** Plays a playlist that isn't stored, from `fromEndSec` before its first song's end. */
  listen(playlist: Playlist, fromEndSec: number): Promise<void>
  leaveListening(): void
  /** Called with the HUD's time per frame; null stops it. */
  setHudListener(listen: ((ms: number) => void) | null): void
}

export const benchHostKey: InjectionKey<BenchHost> = Symbol('benchHost')
