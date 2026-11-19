import type { PlaySetup } from './PlaySetup'

/** The song the play log is recording for, in a profile. */
export interface RecorderEntry {
  readonly profileId: string
  readonly songId: string
}

/**
 * What the player tells the play recorder (brief decision 70). `now` is epoch ms.
 *
 * - `load`: a song or bookmark was loaded (or nothing is): the next Play is a start.
 * - `setup`: the setup in effect and what it matches exactly (a bookmark id, `full:<songId>`,
 *   or null for other setups). A change of either splits the stretch under way.
 * - `jump`: a committed loop change moved the playhead to the new loop start.
 */
export type RecorderEvent =
  | { readonly type: 'load'; readonly entry: RecorderEntry | null; readonly now: number }
  | {
      readonly type: 'setup'
      readonly setup: PlaySetup
      readonly entryId: string | null
      readonly now: number
    }
  | { readonly type: 'play' | 'pause' | 'stop' | 'end' | 'hidden'; readonly now: number }
  | { readonly type: 'visible'; readonly playing: boolean; readonly now: number }
  | { readonly type: 'wrap' | 'jump' | 'tick'; readonly now: number }
