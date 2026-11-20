import type { Ref } from 'vue'

import type { LoopRange } from '@/core/transport/LoopRange'

import type { LoadedSong } from '../playback/LoadedSong'

/**
 * What the player lends the loop editor (brief decision 106), which is shown over it while
 * playback keeps running: the loaded song, the live playhead, and the player's own actions —
 * so a loop set or a seek made in the editor is exactly the player's.
 */
export interface OverviewHost {
  readonly song: Readonly<Ref<LoadedSong | null>>
  readonly songId: Readonly<Ref<string | null>>
  readonly title: Readonly<Ref<string>>
  /** The playhead, in ticks. */
  readonly tick: Readonly<Ref<number>>
  readonly playing: Readonly<Ref<boolean>>
  /** The loop in effect (nudges still settling included). */
  readonly loop: Readonly<Ref<LoopRange | null>>
  seekBar(bar: number): void
  /** A committed loop change: on, with one jump to its start (decision 8). */
  setLoop(range: LoopRange): void
  /** Seeks to the bar (the loop-bounds rule applies) and plays. */
  playFrom(bar: number): void
  /** Loads a bookmark of the loaded song in the player (a normal load). */
  loadBookmark(id: string): void
  saveSelection(range: LoopRange): Promise<void>
  backToPlayer(): void
}
