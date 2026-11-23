import type { Playlist } from '../playlists/Playlist'
import type { Bookmark } from '../practice/Bookmark'
import type { Profile } from '../profiles/Profile'
import type { PlayRecord } from '../stats/PlayRecord'
import type { Session } from '../stats/Session'
import type { ProfileHandAssignment } from './ProfileHandAssignment'

/** Everything that belongs to profiles, as a backup holds it (brief decision 75). */
export interface PracticeData {
  readonly profiles: readonly Profile[]
  readonly bookmarks: readonly Bookmark[]
  readonly handAssignments: readonly ProfileHandAssignment[]
  readonly sessions: readonly Session[]
  readonly playRecords: readonly PlayRecord[]
  /** From backup format 1.4 (milestone 9.5); older backups have none. */
  readonly playlists?: readonly Playlist[]
}
