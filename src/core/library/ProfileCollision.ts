import type { ProfileChoice } from './ProfileChoice'
import type { ProfileFacts } from './ProfileFacts'

/** A backup profile with the same id as a local one: the import asks what to do. */
export interface ProfileCollision {
  readonly local: ProfileFacts
  readonly incoming: ProfileFacts
  /** Merge when the names match, Add as new when they differ. */
  readonly defaultChoice: ProfileChoice
  /** Bookmarks the local profile would have after a merge. */
  readonly mergedBookmarks: number
}
