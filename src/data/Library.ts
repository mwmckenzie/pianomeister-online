import { defaultHands } from '@/core/hands/defaultHands'
import type { HandAssignment } from '@/core/hands/HandAssignment'
import { buildEntries } from '@/core/library/buildEntries'
import { computeSongFacts } from '@/core/library/computeSongFacts'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import { normalizeTags } from '@/core/library/normalizeTags'
import type { SongManifest } from '@/core/library/SongManifest'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import { validateUpload } from '@/core/library/validateUpload'
import { importMidi } from '@/core/song/importMidi'
import { sha256Hex } from '@/core/song/sha256Hex'
import type { MeterOverride } from '@/core/timing/MeterOverride'

import type { BundledSongs } from './BundledSongs'
import type { ImportReport } from './ImportReport'
import type { OpenedSong } from './OpenedSong'
import { DEFAULT_PROFILE_ID, type PianoMeisterDb } from './PianoMeisterDb'
import type { UploadFile } from './UploadFile'
import type { UploadResult } from './UploadResult'
import { factsFailureKey, refreshStaleFacts } from './refreshStaleFacts'

const LAST_SONG_ID = 'lastSongId'

/**
 * The song library: bundled songs plus uploads, with metadata edits, meter overrides and hand
 * assignments. Plain TS over Dexie; the UI wraps it in a store.
 */
export class Library {
  private manifestPromise: Promise<SongManifest> | null = null
  private persistenceRequested = false

  constructor(
    private readonly db: PianoMeisterDb,
    private readonly bundled: BundledSongs,
    private readonly storage: { requestPersistence(): Promise<boolean | null> },
    private readonly profileId = DEFAULT_PROFILE_ID,
  ) {}

  manifest(): Promise<SongManifest> {
    this.manifestPromise ??= this.bundled.manifest().catch((e: unknown) => {
      this.manifestPromise = null
      throw e
    })
    return this.manifestPromise
  }

  async entries(): Promise<LibraryEntry[]> {
    const [manifest, uploads, meta, overrides, hands] = await Promise.all([
      this.manifest(),
      this.db.uploads.orderBy('addedAt').toArray(),
      this.db.songMeta.toArray(),
      this.db.meterOverrides.toArray(),
      this.db.handAssignments.toArray(),
    ])
    return buildEntries(
      manifest,
      uploads,
      new Map(meta.map((m) => [m.songId, m.edit])),
      new Map(overrides.map((o) => [o.songId, o.override])),
      new Map(hands.filter((h) => h.profileId === this.profileId).map((h) => [h.songId, h.hands])),
    )
  }

  /**
   * Brings uploads' stored facts up to FACTS_VERSION in the background, one file at a time;
   * `onRefreshed` runs after each save (see refreshStaleFacts).
   */
  refreshStaleFacts(onRefreshed?: (songId: string) => void | Promise<void>) {
    return refreshStaleFacts(this.db, onRefreshed)
  }

  async entry(songId: string): Promise<LibraryEntry | null> {
    return (await this.entries()).find((e) => e.songId === songId) ?? null
  }

  async openSong(songId: string): Promise<OpenedSong> {
    const entry = await this.entry(songId)
    if (entry === null) throw new Error('Song not found in the library')
    const bytes =
      entry.source === 'bundled'
        ? await this.bundled.bytes(entry.fileName)
        : new Uint8Array((await this.db.uploads.get(songId))?.bytes ?? new ArrayBuffer(0))
    const song = await importMidi(bytes, { fileName: entry.fileName })
    const stored = await this.db.handAssignments.get([this.profileId, songId])
    return {
      entry,
      song,
      hands: stored?.hands ?? defaultHands(song.channels),
      defaultHands: stored === undefined,
      override: entry.override,
    }
  }

  /** Validates, de-duplicates by content hash, parses and stores each file. */
  async upload(files: readonly UploadFile[]): Promise<UploadResult[]> {
    const entries = await this.entries()
    const titles = new Map(entries.map((e) => [e.songId, e.title]))
    const results: UploadResult[] = []
    for (const file of files) {
      const result = await this.addFile(file, titles, Date.now())
      results.push(result)
      if (result.outcome === 'added') titles.set(result.songId, result.title)
    }
    if (results.some((r) => r.outcome === 'added') && !this.persistenceRequested) {
      this.persistenceRequested = true
      await this.storage.requestPersistence()
    }
    return results
  }

  /** Saves the fields that differ from the original; none differing removes the edit. */
  async setMeta(songId: string, fields: SongMetaFields): Promise<void> {
    const entry = await this.entry(songId)
    if (entry === null) return
    const tags = normalizeTags(fields.tags)
    const edit: { title?: string; composer?: string; tags?: string[] } = {}
    const title = fields.title.trim()
    // An empty title isn't useful; keep the original instead.
    if (title !== '' && title !== entry.original.title) edit.title = title
    if (fields.composer.trim() !== entry.original.composer) edit.composer = fields.composer.trim()
    if (tags.join('\n') !== entry.original.tags.join('\n')) edit.tags = tags
    if (Object.keys(edit).length === 0) await this.db.songMeta.delete(songId)
    else await this.db.songMeta.put({ songId, edit })
  }

  async resetMeta(songId: string): Promise<void> {
    await this.db.songMeta.delete(songId)
  }

  async setHands(songId: string, hands: HandAssignment): Promise<void> {
    await this.db.handAssignments.put({ profileId: this.profileId, songId, hands })
  }

  async resetHands(songId: string): Promise<void> {
    await this.db.handAssignments.delete([this.profileId, songId])
  }

  async setOverride(songId: string, override: MeterOverride): Promise<void> {
    await this.db.meterOverrides.put({ songId, override })
  }

  async clearOverride(songId: string): Promise<void> {
    await this.db.meterOverrides.delete(songId)
  }

  /** Removes an upload with its metadata, meter override and hand assignments (decision 35). */
  async deleteUpload(songId: string): Promise<void> {
    const { db } = this
    await db.transaction(
      'rw',
      [db.uploads, db.songMeta, db.meterOverrides, db.handAssignments, db.appState],
      async () => {
        await db.uploads.delete(songId)
        await db.songMeta.delete(songId)
        await db.meterOverrides.delete(songId)
        await db.handAssignments.where('songId').equals(songId).delete()
        const last = await db.appState.get(LAST_SONG_ID)
        if (last?.value === songId) await db.appState.delete(LAST_SONG_ID)
        await db.appState.delete(factsFailureKey(songId))
      },
    )
  }

  async setLastSongId(songId: string): Promise<void> {
    await this.db.appState.put({ key: LAST_SONG_ID, value: songId })
  }

  /** The last opened song if it is still in the library, else the first bundled song. */
  async startSongId(): Promise<string> {
    const [last, entries] = await Promise.all([this.db.appState.get(LAST_SONG_ID), this.entries()])
    const found = entries.find((e) => e.songId === last?.value)
    const first = found ?? entries.find((e) => e.source === 'bundled') ?? entries[0]
    if (first === undefined) throw new Error('The library is empty')
    return first.songId
  }

  async exportArchive(now = new Date()): Promise<Uint8Array> {
    // Loaded on demand: the zip code is only needed for backups, not for playing.
    const { buildArchive } = await import('@/core/library/buildArchive')
    const [uploads, meta, overrides] = await Promise.all([
      this.db.uploads.orderBy('addedAt').toArray(),
      this.db.songMeta.toArray(),
      this.db.meterOverrides.toArray(),
    ])
    return buildArchive({
      uploads: uploads.map((u) => ({ ...u, bytes: new Uint8Array(u.bytes) })),
      meta: new Map(meta.map((m) => [m.songId, m.edit])),
      overrides: new Map(overrides.map((o) => [o.songId, o.override])),
      exportedAt: now,
    })
  }

  /** Throws (with a user-facing reason) when the file isn't a compatible library export. */
  async importArchive(bytes: Uint8Array): Promise<ImportReport> {
    const [{ readArchive }, { planImport }] = await Promise.all([
      import('@/core/library/readArchive'),
      import('@/core/library/planImport'),
    ])
    const archive = readArchive(bytes)
    const uploads = await this.upload(
      archive.uploads.map((u) => ({
        name: u.fileName,
        size: u.bytes.byteLength,
        arrayBuffer: async () => u.bytes.slice().buffer,
      })),
    )
    // Imported uploads keep their original date added.
    for (const [i, result] of uploads.entries()) {
      const addedAt = archive.uploads[i]?.addedAt
      if (result.outcome === 'added' && addedAt !== undefined) {
        await this.db.uploads.update(result.songId, { addedAt })
      }
    }
    const [entries, metaIds, overrideIds] = await Promise.all([
      this.entries(),
      this.db.songMeta.toCollection().primaryKeys(),
      this.db.meterOverrides.toCollection().primaryKeys(),
    ])
    const plan = planImport(archive.document, {
      songIds: new Set(entries.map((e) => e.songId)),
      metaIds: new Set(metaIds),
      overrideIds: new Set(overrideIds),
    })
    await this.db.songMeta.bulkPut(plan.setMeta.map(([songId, edit]) => ({ songId, edit })))
    await this.db.meterOverrides.bulkPut(
      plan.setOverrides.map(([songId, override]) => ({ songId, override })),
    )
    return {
      uploads,
      metaApplied: plan.metaApplied,
      metaKept: plan.metaKept,
      overridesApplied: plan.overridesApplied,
      overridesKept: plan.overridesKept,
      unknownSongs: plan.unknownSongs,
    }
  }

  private async addFile(
    file: UploadFile,
    titles: ReadonlyMap<string, string>,
    addedAt: number,
  ): Promise<UploadResult> {
    const fileName = file.name
    const invalid = validateUpload(file)
    if (invalid !== null) return { fileName, outcome: 'rejected', reason: invalid }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const songId = await sha256Hex(bytes)
    const existing = titles.get(songId)
    if (existing !== undefined) return { fileName, outcome: 'duplicate', songId, title: existing }
    let song
    try {
      song = await importMidi(bytes, { fileName })
    } catch {
      return { fileName, outcome: 'rejected', reason: 'not a readable MIDI file' }
    }
    await this.db.uploads.put({
      songId,
      fileName,
      title: song.title,
      addedAt,
      facts: computeSongFacts(song),
      bytes: bytes.slice().buffer,
    })
    return { fileName, outcome: 'added', songId, title: song.title }
  }
}
