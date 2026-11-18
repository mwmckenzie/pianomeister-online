import type { LoopRange } from '../transport/LoopRange'
import type { PracticeConfig } from './PracticeConfig'

/** A saved practice setup for one song, owned by one profile. Its range is always set. */
export interface Bookmark {
  readonly id: string
  readonly profileId: string
  readonly songId: string
  readonly name: string
  /**
   * True while the name is the automatic one (brief decision 69): it then follows the settings.
   * Typing a name clears it; the name field's reset sets it again.
   */
  readonly autoName: boolean
  readonly config: PracticeConfig & { readonly loop: LoopRange }
  /** Epoch ms. */
  readonly createdAt: number
  readonly updatedAt: number
}
