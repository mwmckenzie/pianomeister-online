import { Dexie, type Table } from 'dexie'

import type { Bookmark } from '@/core/practice/Bookmark'
import { settleBookmark } from '@/core/practice/bookmarkNames'
import { DEFAULT_PROFILE } from '@/core/profiles/DEFAULT_PROFILE'
import type { Profile } from '@/core/profiles/Profile'
import type { PlayRecord } from '@/core/stats/PlayRecord'
import type { Session } from '@/core/stats/Session'

import type { AppStateRow } from './AppStateRow'
import type { StoredHandAssignment } from './StoredHandAssignment'
import type { StoredMeterOverride } from './StoredMeterOverride'
import type { StoredSongMeta } from './StoredSongMeta'
import type { StoredUpload } from './StoredUpload'
import { toPlainData } from './toPlainData'

/** The first profile ("Me"); data stored before profiles existed belongs to it. */
export const DEFAULT_PROFILE_ID = DEFAULT_PROFILE.id

/** Before v3, the last opened song was global; from v3 it is per profile (lastOpenedKey). */
const LEGACY_LAST_SONG_ID = 'lastSongId'

/** The appState key holding a profile's last opened song and bookmark, as JSON. */
export function lastOpenedKey(profileId: string): string {
  return `lastOpened:${profileId}`
}

/**
 * The app's IndexedDB database. Schema changes add a new version() with an upgrade, never
 * edit an existing one.
 */
export class PianoMeisterDb extends Dexie {
  readonly uploads!: Table<StoredUpload, string>
  readonly songMeta!: Table<StoredSongMeta, string>
  readonly meterOverrides!: Table<StoredMeterOverride, string>
  readonly handAssignments!: Table<StoredHandAssignment, [string, string]>
  readonly appState!: Table<AppStateRow, string>
  readonly profiles!: Table<Profile, string>
  readonly bookmarks!: Table<Bookmark, string>
  readonly sessions!: Table<Session, string>
  readonly playRecords!: Table<PlayRecord, string>

  constructor(name = 'pianomeister') {
    super(name)
    this.version(1).stores({
      uploads: 'songId, addedAt',
      songMeta: 'songId',
      meterOverrides: 'songId',
      handAssignments: '[profileId+songId], songId',
      appState: 'key',
    })
    // v2: the schema step only (same tables and indexes). Upload facts are brought up to date
    // separately, whenever they predate FACTS_VERSION (refreshStaleFacts), so a fact added
    // after a database has upgraded still reaches its uploads.
    this.version(2).stores({})
    // v3 (milestone 7): profiles, bookmarks and the play log. Hand assignments already carry a
    // profileId ('default'), so the "Me" profile gets that id and they belong to it as they
    // are; the only data move is the last opened song, which becomes per profile.
    this.version(3)
      .stores({
        profiles: 'id',
        bookmarks: 'id, [profileId+songId], songId',
        sessions: 'id, profileId, [profileId+endedAt]',
        playRecords:
          'id, [profileId+songId], [profileId+bookmarkId], [profileId+startedAt], profileId, songId',
      })
      .upgrade(async (tx) => {
        await tx.table<Profile, string>('profiles').put(DEFAULT_PROFILE)
        const appState = tx.table<AppStateRow, string>('appState')
        const last = await appState.get(LEGACY_LAST_SONG_ID)
        if (last !== undefined) {
          await appState.put({
            key: lastOpenedKey(DEFAULT_PROFILE.id),
            value: JSON.stringify({ songId: last.value, bookmarkId: null }),
          })
          await appState.delete(LEGACY_LAST_SONG_ID)
        }
      })
    // v4: bookmarks gain `autoName` (brief decision 69). Names that are the old range label
    // ("Bars 17–32") become automatic, and take the full summary their settings give.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table<Bookmark, string>('bookmarks')
          .toCollection()
          .modify((bookmark, ref) => {
            ref.value = settleBookmark(bookmark)
          })
      })
    // v5: a play is a start, not a complete pass (brief decision 70). Records keep what they
    // counted: `passes` becomes `plays`. Schema unchanged; nothing else is touched.
    this.version(5)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table<PlayRecord & { passes?: number }, string>('playRecords')
          .toCollection()
          .modify((record) => {
            if (record.plays === undefined) {
              ;(record as { plays: number }).plays = record.passes ?? 0
            }
            delete record.passes
          })
      })
    // A new database starts with the "Me" profile (brief decision 65).
    this.on('populate', (tx) => {
      void tx.table<Profile, string>('profiles').add(DEFAULT_PROFILE)
    })
    // Every write on every table stores plain data, so callers can't break a write by passing
    // Vue reactive state (IndexedDB rejects proxies with a DataCloneError).
    this.use({
      stack: 'dbcore',
      name: 'plainData',
      create: (down) => ({
        ...down,
        table: (name) => {
          const table = down.table(name)
          return {
            ...table,
            mutate: (request) =>
              table.mutate(
                request.type === 'add' || request.type === 'put'
                  ? { ...request, values: request.values.map(toPlainData) }
                  : request,
              ),
          }
        },
      }),
    })
  }
}
