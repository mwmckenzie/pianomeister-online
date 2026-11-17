import { Dexie, type Table } from 'dexie'

import type { AppStateRow } from './AppStateRow'
import type { StoredHandAssignment } from './StoredHandAssignment'
import type { StoredMeterOverride } from './StoredMeterOverride'
import type { StoredSongMeta } from './StoredSongMeta'
import type { StoredUpload } from './StoredUpload'
import { toPlainData } from './toPlainData'

/** Until profiles arrive (milestone 7), everything per-profile belongs to this one. */
export const DEFAULT_PROFILE_ID = 'default'

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
