import type { Profile } from '../profiles/Profile'

/** One side of a profile collision, as the import dialog describes it. */
export interface ProfileFacts {
  readonly profile: Profile
  readonly bookmarks: number
  readonly playedMs: number
  readonly lastPlayedAt: number | null
}
