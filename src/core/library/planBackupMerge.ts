import { isFullSongId } from '../practice/fullSongId'
import type { Profile } from '../profiles/Profile'
import type { BackupMergePlan } from './BackupMergePlan'
import type { PracticeData } from './PracticeData'
import type { ProfileChoice } from './ProfileChoice'

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] }

const owned = <T extends { readonly profileId: string }>(rows: readonly T[], id: string) =>
  rows.filter((row) => row.profileId === id)

/**
 * How a backup's profiles merge into this device's (brief decision 75). Profiles the device
 * doesn't have are added with all their rows. A colliding profile (same id) follows its choice
 * — missing a choice counts as Merge:
 *
 * - **merge**: adds the backup's rows that aren't here yet (by id; hand assignments by song).
 *   Nothing local changes.
 * - **addNew**: a separate profile "⟨name⟩ (imported)" with fresh ids for the profile, its
 *   bookmarks, sessions and records (references between them follow).
 * - **replace**: the local profile's bookmarks, history and hand assignments are cleared, then
 *   the backup's version is written, profile name and colour included.
 *
 * Rows of profiles that aren't in the backup's profile list are ignored.
 */
export function planBackupMerge(
  incoming: PracticeData,
  local: PracticeData,
  choices: ReadonlyMap<string, ProfileChoice>,
  newId: () => string,
): BackupMergePlan {
  const localProfiles = new Map(local.profiles.map((p) => [p.id, p]))
  const has = {
    bookmark: new Set(local.bookmarks.map((b) => b.id)),
    session: new Set(local.sessions.map((s) => s.id)),
    record: new Set(local.playRecords.map((r) => r.id)),
    hands: new Set(local.handAssignments.map((h) => `${h.profileId}\u0000${h.songId}`)),
  }
  const add: Mutable<PracticeData> = {
    profiles: [],
    bookmarks: [],
    handAssignments: [],
    sessions: [],
    playRecords: [],
  }
  const clearProfileIds: string[] = []
  const merged: { name: string; bookmarksAdded: number }[] = []
  const replaced: string[] = []
  let addedProfiles = 0

  for (const profile of incoming.profiles) {
    const mine = localProfiles.get(profile.id)
    const bookmarks = owned(incoming.bookmarks, profile.id)
    const sessions = owned(incoming.sessions, profile.id)
    const records = owned(incoming.playRecords, profile.id)
    const hands = owned(incoming.handAssignments, profile.id)
    const choice = mine === undefined ? 'new' : (choices.get(profile.id) ?? 'merge')

    if (choice === 'merge' && mine !== undefined) {
      const newBookmarks = bookmarks.filter((b) => !has.bookmark.has(b.id))
      add.bookmarks.push(...newBookmarks)
      add.sessions.push(...sessions.filter((s) => !has.session.has(s.id)))
      add.playRecords.push(...records.filter((r) => !has.record.has(r.id)))
      add.handAssignments.push(
        ...hands.filter((h) => !has.hands.has(`${h.profileId}\u0000${h.songId}`)),
      )
      merged.push({ name: mine.name, bookmarksAdded: newBookmarks.length })
    } else if (choice === 'addNew') {
      const id = newId()
      // Old id → new id, filled as ids are met, so references stay consistent even to a
      // session or bookmark the backup doesn't contain.
      const bookmarkIds = new Map<string, string>()
      const sessionIds = new Map<string, string>()
      const remap = (map: Map<string, string>, old: string) => {
        const known = map.get(old)
        if (known !== undefined) return known
        const fresh = newId()
        map.set(old, fresh)
        return fresh
      }
      const renamed: Profile = { ...profile, id, name: `${profile.name} (imported)` }
      add.profiles.push(renamed)
      add.bookmarks.push(
        ...bookmarks.map((b) => ({ ...b, id: remap(bookmarkIds, b.id), profileId: id })),
      )
      add.sessions.push(
        ...sessions.map((s) => ({ ...s, id: remap(sessionIds, s.id), profileId: id })),
      )
      add.playRecords.push(
        ...records.map((r) => ({
          ...r,
          id: newId(),
          profileId: id,
          sessionId: remap(sessionIds, r.sessionId),
          bookmarkId: isFullSongId(r.bookmarkId) ? r.bookmarkId : remap(bookmarkIds, r.bookmarkId),
        })),
      )
      add.handAssignments.push(...hands.map((h) => ({ ...h, profileId: id })))
      addedProfiles++
    } else if (choice === 'replace' && mine !== undefined) {
      clearProfileIds.push(profile.id)
      add.profiles.push(profile)
      // The local profile's own rows are cleared; ids used by other profiles still win.
      const ownIds = (rows: readonly { readonly id: string; readonly profileId: string }[]) =>
        new Set(rows.filter((r) => r.profileId !== profile.id).map((r) => r.id))
      const others = {
        bookmark: ownIds(local.bookmarks),
        session: ownIds(local.sessions),
        record: ownIds(local.playRecords),
      }
      add.bookmarks.push(...bookmarks.filter((b) => !others.bookmark.has(b.id)))
      add.sessions.push(...sessions.filter((s) => !others.session.has(s.id)))
      add.playRecords.push(...records.filter((r) => !others.record.has(r.id)))
      add.handAssignments.push(...hands)
      replaced.push(mine.name)
    } else {
      add.profiles.push(profile)
      add.bookmarks.push(...bookmarks.filter((b) => !has.bookmark.has(b.id)))
      add.sessions.push(...sessions.filter((s) => !has.session.has(s.id)))
      add.playRecords.push(...records.filter((r) => !has.record.has(r.id)))
      add.handAssignments.push(...hands)
      addedProfiles++
    }
  }
  return { clearProfileIds, add, summary: { merged, replaced, addedProfiles } }
}
