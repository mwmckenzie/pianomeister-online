import type { HandAssignment } from '../hands/HandAssignment'

/** A song's hand-channel assignment for one profile (brief decision 6). */
export interface ProfileHandAssignment {
  readonly profileId: string
  readonly songId: string
  readonly hands: HandAssignment
}
