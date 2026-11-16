import type { HandAssignment } from '@/core/hands/HandAssignment'

/** Per profile and song (brief decision 6); no row means the default assignment. */
export interface StoredHandAssignment {
  readonly profileId: string
  readonly songId: string
  readonly hands: HandAssignment
}
