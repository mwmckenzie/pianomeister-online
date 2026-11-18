import type { LoopRange } from '../transport/LoopRange'
import type { PracticeConfig } from './PracticeConfig'

/** One edit in the bookmark manager: a typed name, the name reset, or new settings. */
export interface BookmarkEdit {
  readonly name?: string
  /** True: the name field's reset (the name follows the settings again). */
  readonly autoName?: boolean
  readonly config?: PracticeConfig & { readonly loop: LoopRange }
}
