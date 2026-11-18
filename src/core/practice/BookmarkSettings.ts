import type { LoopRange } from '../transport/LoopRange'
import type { PracticeConfig } from './PracticeConfig'

/** What makes two bookmarks the same: the song and the setup (names don't count). */
export interface BookmarkSettings {
  readonly songId: string
  readonly config: PracticeConfig & { readonly loop: LoopRange }
}
