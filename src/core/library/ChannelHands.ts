import type { HandAssignment } from '../hands/HandAssignment'

/**
 * A channel map from before milestone 10.5. It is still the player's, and becomes PlayerHands (or
 * is dropped, when it equals the default map) once the song's file is read.
 */
export interface ChannelHands {
  readonly profileId: string
  readonly songId: string
  readonly hands: HandAssignment
}
