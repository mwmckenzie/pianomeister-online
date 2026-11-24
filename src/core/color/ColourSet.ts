import type { CustomSetId } from '../settings/CustomSetId'

/** A note colour set of the player's own (milestone 10.6). */
export interface ColourSet {
  readonly id: CustomSetId
  readonly name: string
  /** Twelve #RRGGBB, index 0 = C. */
  readonly colours: readonly string[]
}
