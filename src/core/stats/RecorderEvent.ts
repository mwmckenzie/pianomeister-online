import type { PlaySetup } from './PlaySetup'

/** What the play log is attributed to: the loaded bookmark or Full song of one song. */
export interface RecorderEntry {
  readonly profileId: string
  readonly songId: string
  /** A bookmark id, or `full:<songId>`. */
  readonly entryId: string
}

/**
 * What the player tells the play recorder. `now` is epoch ms. "Range start" means the first bar
 * of the effective range (the loop, or the song's start without one), or its pre-roll.
 */
export type RecorderEvent =
  | { readonly type: 'load'; readonly entry: RecorderEntry | null; readonly now: number }
  | {
      readonly type: 'play'
      readonly atRangeStart: boolean
      readonly rangeMatches: boolean
      readonly now: number
    }
  | { readonly type: 'pause' | 'stop' | 'hidden'; readonly now: number }
  | { readonly type: 'visible'; readonly playing: boolean; readonly now: number }
  | { readonly type: 'seek'; readonly atRangeStart: boolean; readonly now: number }
  /** The effective loop range changed; does it now equal the loaded entry's saved range? */
  | { readonly type: 'range'; readonly matchesSaved: boolean; readonly now: number }
  | { readonly type: 'wrap' | 'end' | 'tick'; readonly now: number }
  /** Tempo, loop, metronome or temporary changes: a stretch under way ends and a new one starts. */
  | { readonly type: 'setup'; readonly setup: PlaySetup; readonly now: number }
