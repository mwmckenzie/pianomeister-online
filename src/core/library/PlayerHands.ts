import type { CachedHands } from '../hands/CachedHands'
import type { HandSettings } from '../hands/HandSettings'

/** A profile's own hands for a song (milestone 10.5): having this row is what "user" means. */
export interface PlayerHands {
  readonly profileId: string
  readonly songId: string
  readonly settings: HandSettings
  readonly resolved: CachedHands
}
