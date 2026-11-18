import type { PracticeData } from './PracticeData'

/** What a backup import writes for profiles, and what its summary toast reports. */
export interface BackupMergePlan {
  /** Profiles whose local bookmarks, history and hand assignments are deleted first (Replace). */
  readonly clearProfileIds: readonly string[]
  /** Rows to add (profiles may be put: a replaced profile takes the backup's name and colour). */
  readonly add: PracticeData
  readonly summary: {
    readonly merged: readonly { readonly name: string; readonly bookmarksAdded: number }[]
    readonly replaced: readonly string[]
    /** New profiles: backup profiles without a collision plus those added as new. */
    readonly addedProfiles: number
  }
}
