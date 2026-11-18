import { Dexie } from 'dexie'

import { DEFAULT_PROFILE } from '@/core/profiles/DEFAULT_PROFILE'
import type { Profile } from '@/core/profiles/Profile'

import { lastOpenedKey, type PianoMeisterDb } from './PianoMeisterDb'

const ACTIVE_PROFILE_ID = 'activeProfileId'

/** Local profiles (brief decision 65): every profile write goes through here. */
export class Profiles {
  constructor(
    private readonly db: PianoMeisterDb,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  /** Oldest first. There is always at least one: "Me" is recreated if the table is empty. */
  async list(): Promise<Profile[]> {
    const profiles = await this.db.profiles.toArray()
    if (profiles.length > 0) return profiles.sort((a, b) => a.createdAt - b.createdAt)
    await this.db.profiles.put(DEFAULT_PROFILE)
    return [DEFAULT_PROFILE]
  }

  /** The active profile id, or the first profile's when the stored one is gone. */
  async activeId(): Promise<string> {
    const [row, profiles] = await Promise.all([
      this.db.appState.get(ACTIVE_PROFILE_ID),
      this.list(),
    ])
    const active = profiles.find((p) => p.id === row?.value) ?? profiles[0] ?? DEFAULT_PROFILE
    return active.id
  }

  async setActive(profileId: string): Promise<void> {
    await this.db.appState.put({ key: ACTIVE_PROFILE_ID, value: profileId })
  }

  async create(name: string, color: string, now = Date.now()): Promise<Profile> {
    const profile: Profile = { id: this.newId(), name: name.trim(), color, createdAt: now }
    await this.db.profiles.add(profile)
    return profile
  }

  async update(
    profileId: string,
    changes: Partial<Pick<Profile, 'name' | 'color'>>,
  ): Promise<void> {
    const name = changes.name?.trim()
    await this.db.profiles.update(profileId, {
      ...changes,
      ...(name === undefined ? {} : { name }),
    })
  }

  /**
   * Deletes a profile with its bookmarks, play log, sessions, hand assignments and last opened
   * song. The last remaining profile can't be deleted.
   */
  async delete(profileId: string): Promise<void> {
    const { db } = this
    await db.transaction(
      'rw',
      [db.profiles, db.bookmarks, db.sessions, db.playRecords, db.handAssignments, db.appState],
      async () => {
        if ((await db.profiles.count()) <= 1) throw new Error("The last profile can't be deleted")
        await clearProfileData(db, profileId)
        await db.profiles.delete(profileId)
        const active = await db.appState.get(ACTIVE_PROFILE_ID)
        if (active?.value === profileId) await db.appState.delete(ACTIVE_PROFILE_ID)
      },
    )
  }
}

/**
 * Removes everything that belongs to a profile, but not the profile itself. Call inside a
 * transaction over those tables (profile delete, backup Replace).
 */
export async function clearProfileData(db: PianoMeisterDb, profileId: string): Promise<void> {
  await db.bookmarks
    .where('[profileId+songId]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .delete()
  await db.sessions.where('profileId').equals(profileId).delete()
  await db.playRecords.where('profileId').equals(profileId).delete()
  await db.handAssignments
    .where('[profileId+songId]')
    .between([profileId, Dexie.minKey], [profileId, Dexie.maxKey])
    .delete()
  await db.appState.delete(lastOpenedKey(profileId))
}
