import type { ColourSetMerge } from '@/core/color/ColourSetMerge'
import { EMPTY_COLOUR_SETS } from '@/core/color/EMPTY_COLOUR_SETS'
import type { NoteColourSets } from '@/core/color/NoteColourSets'
import { assignmentHandOf } from '@/core/hands/assignmentHandOf'
import type { CachedHands } from '@/core/hands/CachedHands'
import { channelHandOf } from '@/core/hands/channelHandOf'
import { computeVoiceStats } from '@/core/hands/computeVoiceStats'
import { defaultHands } from '@/core/hands/defaultHands'
import type { DetectedHands } from '@/core/hands/DetectedHands'
import { DETECTOR_VERSION } from '@/core/hands/DETECTOR_VERSION'
import { extractNotes } from '@/core/hands/extractNotes'
import { handsHash } from '@/core/hands/handsHash'
import type { HandOf } from '@/core/hands/HandOf'
import type { HandSettings } from '@/core/hands/HandSettings'
import { resolveSongHands } from '@/core/hands/resolveSongHands'
import { rolesFromChannels } from '@/core/hands/rolesFromChannels'
import { sameChannelHands } from '@/core/hands/sameChannelHands'
import { SPLIT_ALGORITHMS } from '@/core/hands/SPLIT_ALGORITHMS'
import { summariseHands } from '@/core/hands/summariseHands'
import { voiceId } from '@/core/hands/voiceId'
import { buildEntries } from '@/core/library/buildEntries'
import { computeSongFacts } from '@/core/library/computeSongFacts'
import { guessSongMetadata } from '@/core/library/guessSongMetadata'
import type { BackupMergePlan } from '@/core/library/BackupMergePlan'
import type { ArchiveContents } from '@/core/library/ArchiveContents'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { PracticeData } from '@/core/library/PracticeData'
import type { ProfileChoice } from '@/core/library/ProfileChoice'
import type { ProfileCollision } from '@/core/library/ProfileCollision'
import { normalizeTags } from '@/core/library/normalizeTags'
import type { SongManifest } from '@/core/library/SongManifest'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import { validateUpload } from '@/core/library/validateUpload'
import { readMidiFile } from '@/core/midi/readMidiFile'
import { importMidi } from '@/core/song/importMidi'
import { parseMidi } from '@/core/song/parseMidi'
import { readMidiText } from '@/core/song/readMidiText'
import { sha256Hex } from '@/core/song/sha256Hex'
import type { Song } from '@/core/song/Song'
import type { MeterOverride } from '@/core/timing/MeterOverride'

import type { BundledSongs } from './BundledSongs'
import type { HandDetails } from './HandDetails'
import type { ImportReport } from './ImportReport'
import type { LastOpened } from './LastOpened'
import type { OpenedSong } from './OpenedSong'
import {
  DEFAULT_PROFILE_ID,
  lastOpenedKey,
  NEW_DATABASE_KEY,
  type PianoMeisterDb,
} from './PianoMeisterDb'
import { clearProfileData } from './Profiles'
import type { UploadFile } from './UploadFile'
import type { UploadResult } from './UploadResult'
import { factsFailureKey, refreshStaleFacts } from './refreshStaleFacts'

/** appState key: the DETECTOR_VERSION whose background pass has finished. */
const HANDS_PASS_KEY = 'handsPass'

/** A backup read and checked against this device, before anything is written. */
export interface PreparedImport {
  readonly archive: ArchiveContents
  /** Backup profiles whose id exists here: the import asks what to do with each. */
  readonly collisions: readonly ProfileCollision[]
}

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
    private profileId = DEFAULT_PROFILE_ID,
  ) {}

  /** Per-profile data (hand assignments, last opened song) follows the active profile. */
  setProfile(profileId: string): void {
    this.profileId = profileId
  }

  manifest(): Promise<SongManifest> {
    this.manifestPromise ??= this.bundled.manifest().catch((e: unknown) => {
      this.manifestPromise = null
      throw e
    })
    return this.manifestPromise
  }

  async entries(): Promise<LibraryEntry[]> {
    const [manifest, uploads, meta, overrides, hands, detections] = await Promise.all([
      this.manifest(),
      this.db.uploads.orderBy('addedAt').toArray(),
      this.db.songMeta.toArray(),
      this.db.meterOverrides.toArray(),
      this.db.handAssignments.toArray(),
      this.db.handDetections.toArray(),
    ])
    return buildEntries(
      manifest,
      uploads,
      new Map(meta.map((m) => [m.songId, m.edit])),
      new Map(overrides.map((o) => [o.songId, o.override])),
      new Map(hands.filter((h) => h.profileId === this.profileId).map((h) => [h.songId, h])),
      new Map(detections.map((d) => [d.songId, d])),
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
    const bytes = await this.fileBytes(entry)
    const song = await importMidi(bytes, { fileName: entry.fileName })
    return {
      entry,
      song,
      handOf: await this.handOf(songId, song, bytes),
      override: entry.override,
    }
  }

  /** A song's MIDI file. */
  async songBytes(songId: string): Promise<Uint8Array> {
    const entry = await this.entry(songId)
    if (entry === null) throw new Error('Song not found in the library')
    return this.fileBytes(entry)
  }

  private async fileBytes(entry: LibraryEntry): Promise<Uint8Array> {
    if (entry.source === 'bundled') return this.bundled.bytes(entry.fileName)
    const upload = await this.db.uploads.get(entry.songId)
    return new Uint8Array(upload?.bytes ?? new ArrayBuffer(0))
  }

  /**
   * Every note's hand. Reads the stored, resolved hands: a split only runs here when a profile's
   * hands were resolved by an older version of the methods.
   */
  private async handOf(songId: string, song: Song, bytes: Uint8Array): Promise<HandOf> {
    await this.convertChannelHands(songId, song)
    const row = await this.db.handAssignments.get([this.profileId, songId])
    if (row !== undefined && 'settings' in row) {
      const current =
        row.resolved.hash === handsHash(row.settings)
          ? assignmentHandOf(song.noteIds, row.resolved.hands)
          : null
      if (current !== null) return current
      const resolved = resolveSongHands(bytes, row.settings)
      await this.db.handAssignments.put({ ...row, resolved })
      const fresh = assignmentHandOf(song.noteIds, resolved.hands)
      if (fresh !== null) return fresh
    }
    const detected = await this.db.handDetections.get(songId)
    return (
      (detected === undefined ? null : assignmentHandOf(song.noteIds, detected.resolved.hands)) ??
      channelHandOf(defaultHands(song.channels))
    )
  }

  /**
   * Turns channel maps from before milestone 10.5 into voice roles, for every profile: a map equal
   * to the default is dropped (the song is detection's), any other stays the player's.
   */
  private async convertChannelHands(
    songId: string,
    song: Pick<Song, 'channels' | 'notes' | 'noteIds'>,
  ): Promise<void> {
    const { db } = this
    const old = (await db.handAssignments.where('songId').equals(songId).toArray()).filter(
      (row) => 'hands' in row,
    )
    if (old.length === 0) return
    const voices = [
      ...new Map(song.notes.map((n) => [voiceId(n), { id: voiceId(n), channel: n.channel }])),
    ].map(([, v]) => v)
    const defaults = defaultHands(song.channels)
    await db.transaction('rw', db.handAssignments, async () => {
      for (const { profileId, hands } of old) {
        const key: [string, string] = [profileId, songId]
        // Saved by the player in the meantime: theirs stands.
        const now = await db.handAssignments.get(key)
        if (now === undefined || !('hands' in now)) continue
        if (sameChannelHands(song.channels, hands, defaults)) {
          await db.handAssignments.delete(key)
          continue
        }
        const settings: HandSettings = {
          roles: rolesFromChannels(voices, hands),
          algorithm: SPLIT_ALGORITHMS[0].id,
          params: {},
          flips: {},
        }
        await db.handAssignments.put({
          profileId,
          songId,
          settings,
          resolved: wholeVoiceHands(song, settings),
        })
      }
    })
  }

  /** A song's hands in full: voices, the settings in effect and detection's reasons. */
  async handDetails(songId: string): Promise<HandDetails> {
    const bytes = await this.songBytes(songId)
    const song = parseMidi(bytes, { fileName: '' })
    await this.convertChannelHands(songId, song)
    const [row, detected, entry] = await Promise.all([
      this.db.handAssignments.get([this.profileId, songId]),
      this.db.handDetections.get(songId),
      this.entry(songId),
    ])
    if (entry === null) throw new Error('Song not found in the library')
    let voices = detected?.voices
    if (voices === undefined) {
      const file = readMidiFile(bytes)
      voices = computeVoiceStats(file, extractNotes(file))
    }
    const settings =
      row !== undefined && 'settings' in row
        ? row.settings
        : (detected?.settings ?? {
            roles: rolesFromChannels(voices, defaultHands(song.channels)),
            algorithm: SPLIT_ALGORITHMS[0].id,
            params: {},
            flips: {},
          })
    return {
      hands: entry.hands,
      voices,
      settings,
      detected: detected?.settings ?? null,
      guesses: detected?.guesses ?? [],
    }
  }

  /** Saves the profile's own hands: from now on detection doesn't decide this song's. */
  async setHands(songId: string, settings: HandSettings, resolved: CachedHands): Promise<void> {
    await this.db.handAssignments.put({ profileId: this.profileId, songId, settings, resolved })
  }

  /** Stores what detection found, unless the song is gone. Never touches a profile's hands. */
  async saveDetection(songId: string, detected: DetectedHands): Promise<boolean> {
    if ((await this.entry(songId)) === null) return false
    await this.db.handDetections.put({ songId, ...detected })
    return true
  }

  /**
   * Songs the background pass should detect: on its first run every song without a current
   * detection; after a detector change only songs detected by an older version.
   */
  async songsToDetect(): Promise<string[]> {
    const [entries, detections, done] = await Promise.all([
      this.entries(),
      this.db.handDetections.toArray(),
      this.db.appState.get(HANDS_PASS_KEY),
    ])
    const doneVersion = Number(done?.value ?? 0)
    if (doneVersion >= DETECTOR_VERSION) return []
    const versions = new Map(detections.map((d) => [d.songId, d.detectorVersion]))
    return entries
      .map((e) => e.songId)
      .filter((id) => {
        const version = versions.get(id)
        return version === undefined ? doneVersion === 0 : version < DETECTOR_VERSION
      })
  }

  async finishHandsPass(): Promise<void> {
    await this.db.appState.put({ key: HANDS_PASS_KEY, value: String(DETECTOR_VERSION) })
  }

  /** A database made by this version: its bundled songs are detected without a toast. */
  async handsPassIsQuiet(): Promise<boolean> {
    return (await this.db.appState.get(NEW_DATABASE_KEY)) !== undefined
  }

  /** Validates, de-duplicates by content hash, parses and stores each file. */
  async upload(files: readonly UploadFile[]): Promise<UploadResult[]> {
    const entries = await this.entries()
    const titles = new Map(entries.map((e) => [e.songId, e.title]))
    const composers = libraryComposers(entries)
    const results: UploadResult[] = []
    for (const file of files) {
      const result = await this.addFile(file, titles, composers, Date.now())
      results.push(result)
      if (result.outcome === 'added') titles.set(result.songId, result.title)
    }
    if (results.some((r) => r.outcome === 'added') && !this.persistenceRequested) {
      this.persistenceRequested = true
      await this.storage.requestPersistence()
    }
    return results
  }

  /**
   * A fresh guess at an upload's title and composer from its file (brief decision 79), for
   * "Guess from file"; null for a bundled song or a missing upload. Nothing is saved.
   */
  async guessMeta(songId: string): Promise<Pick<SongMetaFields, 'title' | 'composer'> | null> {
    const upload = await this.db.uploads.get(songId)
    if (upload === undefined) return null
    const others = (await this.entries()).filter((e) => e.songId !== songId)
    const text = readMidiText(new Uint8Array(upload.bytes))
    return guessSongMetadata({ fileName: upload.fileName, text }, libraryComposers(others))
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

  async setOverride(songId: string, override: MeterOverride): Promise<void> {
    await this.db.meterOverrides.put({ songId, override })
  }

  async clearOverride(songId: string): Promise<void> {
    await this.db.meterOverrides.delete(songId)
  }

  /**
   * Removes an upload with its metadata, meter override and hand assignments (all profiles,
   * decision 35). Its bookmarks and play log are kept unless `withPracticeData` (decision 74):
   * they are keyed by the content hash and come back with a re-upload.
   */
  async deleteUpload(songId: string, options: { withPracticeData?: boolean } = {}): Promise<void> {
    const { db } = this
    await db.transaction(
      'rw',
      [
        db.uploads,
        db.songMeta,
        db.meterOverrides,
        db.handAssignments,
        db.handDetections,
        db.appState,
        db.bookmarks,
        db.playRecords,
      ],
      async () => {
        await db.uploads.delete(songId)
        await db.songMeta.delete(songId)
        await db.meterOverrides.delete(songId)
        await db.handAssignments.where('songId').equals(songId).delete()
        await db.handDetections.delete(songId)
        if (options.withPracticeData === true) {
          await db.bookmarks.where('songId').equals(songId).delete()
          await db.playRecords.where('songId').equals(songId).delete()
        }
        // Any profile whose last opened song this was starts elsewhere next time.
        const lastOpened = await db.appState.where('key').startsWith(lastOpenedKey('')).toArray()
        for (const row of lastOpened) {
          if (parseLastOpened(row.value)?.songId === songId) await db.appState.delete(row.key)
        }
        await db.appState.delete(factsFailureKey(songId))
      },
    )
  }

  async setLastOpened(songId: string, bookmarkId: string | null): Promise<void> {
    const value: LastOpened = { songId, bookmarkId }
    await this.db.appState.put({ key: lastOpenedKey(this.profileId), value: JSON.stringify(value) })
  }

  /** Where playback stopped in the last opened song (m7-7 decision 6); nothing without one. */
  async setStoppedBar(bar: number): Promise<void> {
    const key = lastOpenedKey(this.profileId)
    const row = await this.db.appState.get(key)
    const last = row === undefined ? null : parseLastOpened(row.value)
    if (last === null || last.bar === bar) return
    await this.db.appState.put({ key, value: JSON.stringify({ ...last, bar }) })
  }

  /** The profile's last opened entry as stored, or null (none, or its song is gone). */
  async lastOpened(): Promise<LastOpened | null> {
    const [row, entries] = await Promise.all([
      this.db.appState.get(lastOpenedKey(this.profileId)),
      this.entries(),
    ])
    const last = row === undefined ? null : parseLastOpened(row.value)
    return last !== null && entries.some((e) => e.songId === last.songId) ? last : null
  }

  /**
   * What the player opens on start (brief decision 27): the profile's last opened song (and
   * bookmark) if the song is still in the library, else the first bundled song.
   */
  async startEntry(): Promise<LastOpened> {
    const [row, entries] = await Promise.all([
      this.db.appState.get(lastOpenedKey(this.profileId)),
      this.entries(),
    ])
    const last = row === undefined ? null : parseLastOpened(row.value)
    if (last !== null && entries.some((e) => e.songId === last.songId)) return last
    const first = entries.find((e) => e.source === 'bundled') ?? entries[0]
    if (first === undefined) throw new Error('The library is empty')
    return { songId: first.songId, bookmarkId: null }
  }

  /** Every profile with all its rows, as a backup holds them. */
  async practiceData(): Promise<PracticeData> {
    const { db } = this
    const [profiles, bookmarks, handAssignments, sessions, playRecords, playlists] =
      await Promise.all([
        db.profiles.toArray(),
        db.bookmarks.toArray(),
        db.handAssignments.toArray(),
        db.sessions.toArray(),
        db.playRecords.toArray(),
        db.playlists.toArray(),
      ])
    return { profiles, bookmarks, handAssignments, sessions, playRecords, playlists }
  }

  async exportArchive(
    now = new Date(),
    noteColourSets: NoteColourSets = EMPTY_COLOUR_SETS,
  ): Promise<Uint8Array> {
    // Loaded on demand: the zip code is only needed for backups, not for playing.
    const [{ buildArchive }, { toLookFile }] = await Promise.all([
      import('@/core/library/buildArchive'),
      import('@/core/looks/toLookFile'),
    ])
    const [uploads, meta, overrides, practice, looks] = await Promise.all([
      this.db.uploads.orderBy('addedAt').toArray(),
      this.db.songMeta.toArray(),
      this.db.meterOverrides.toArray(),
      this.practiceData(),
      this.db.looks.orderBy('createdAt').toArray(),
    ])
    return buildArchive({
      uploads: uploads.map((u) => ({ ...u, bytes: new Uint8Array(u.bytes) })),
      meta: new Map(meta.map((m) => [m.songId, m.edit])),
      overrides: new Map(overrides.map((o) => [o.songId, o.override])),
      practice,
      looks: toLookFile(looks, noteColourSets),
      noteColourSets,
      exportedAt: now,
    })
  }

  /**
   * Reads a backup and finds the profiles that collide with local ones, writing nothing (the
   * user may still cancel). Throws (with a user-facing reason) when the file isn't a
   * compatible library export.
   */
  async prepareImport(bytes: Uint8Array): Promise<PreparedImport> {
    const [{ readArchive }, { profileCollisions }] = await Promise.all([
      import('@/core/library/readArchive'),
      import('@/core/library/profileCollisions'),
    ])
    const archive = readArchive(bytes)
    const incoming = archive.document.practice
    const collisions =
      incoming === undefined ? [] : profileCollisions(incoming, await this.practiceData())
    return { archive, collisions }
  }

  /** Writes a prepared backup with the user's choice for each colliding profile. */
  async applyImport(
    prepared: PreparedImport,
    choices: ReadonlyMap<string, ProfileChoice>,
    newId: () => string = () => crypto.randomUUID(),
    noteColourSets: NoteColourSets = EMPTY_COLOUR_SETS,
  ): Promise<ImportReport> {
    const [{ planImport }, { planBackupMerge }, { mergeColourSets, applyColourSetMerge }] =
      await Promise.all([
        import('@/core/library/planImport'),
        import('@/core/library/planBackupMerge'),
        import('@/core/color/mergeColourSets'),
      ])
    const { archive } = prepared
    // Colour sets first: the backup's looks follow any that get another id here.
    const colourSets = mergeColourSets(
      noteColourSets,
      archive.document.noteColourSets ?? EMPTY_COLOUR_SETS,
      newId,
    )
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
    const incoming = archive.document.practice
    const profiles =
      incoming === undefined
        ? { merged: [], replaced: [], addedProfiles: 0 }
        : await this.mergePractice(
            planBackupMerge(incoming, await this.practiceData(), choices, newId),
          )
    return {
      uploads,
      profiles,
      looksAdded: await this.mergeLooks(archive.document.looks, newId, {
        sets: applyColourSetMerge(noteColourSets, colourSets),
        idMap: colourSets.idMap,
      }),
      colourSets,
      metaApplied: plan.metaApplied,
      metaKept: plan.metaKept,
      overridesApplied: plan.overridesApplied,
      overridesKept: plan.overridesKept,
      unknownSongs: plan.unknownSongs,
    }
  }

  /**
   * Adds the backup's saved looks (milestone 9.1): identical ones are skipped, the rest are
   * added beside the local ones under a new id or "Name (2)" when theirs is taken — nothing
   * local is overwritten. Returns how many were added.
   */
  private async mergeLooks(
    file: unknown,
    newId: () => string,
    colours: { readonly sets: NoteColourSets; readonly idMap: ColourSetMerge['idMap'] },
  ): Promise<number> {
    if (file === undefined) return 0
    const { readLookFile } = await import('@/core/looks/readLookFile')
    return this.db.transaction('rw', this.db.looks, async () => {
      const existing = await this.db.looks.toArray()
      const result = readLookFile(file, existing, newId, new Date().toISOString(), true, colours)
      if (!result.ok) return 0
      await this.db.looks.bulkAdd([...result.looks])
      return result.looks.length
    })
  }

  /** Applies a backup merge plan in one transaction: all of it or nothing. */
  private async mergePractice(plan: BackupMergePlan): Promise<BackupMergePlan['summary']> {
    const { db } = this
    await db.transaction(
      'rw',
      [
        db.profiles,
        db.bookmarks,
        db.sessions,
        db.playRecords,
        db.handAssignments,
        db.appState,
        db.playlists,
      ],
      async () => {
        for (const id of plan.clearProfileIds) await clearProfileData(db, id)
        await db.profiles.bulkPut([...plan.add.profiles])
        await db.bookmarks.bulkPut([...plan.add.bookmarks])
        await db.sessions.bulkPut([...plan.add.sessions])
        await db.playRecords.bulkPut([...plan.add.playRecords])
        await db.handAssignments.bulkPut([...plan.add.handAssignments])
        await db.playlists.bulkPut([...(plan.add.playlists ?? [])])
      },
    )
    return plan.summary
  }

  private async addFile(
    file: UploadFile,
    titles: ReadonlyMap<string, string>,
    composers: readonly string[],
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
    // The guess is the upload's original title and composer: "Reset to original" returns to it.
    const guess = guessSongMetadata({ fileName, text: readMidiText(bytes) }, composers)
    await this.db.uploads.put({
      songId,
      fileName,
      title: guess.title,
      composer: guess.composer,
      addedAt,
      facts: computeSongFacts(song),
      bytes: bytes.slice().buffer,
    })
    return { fileName, outcome: 'added', songId, title: guess.title }
  }
}

/** The hands of settings without Split voices or flips (a converted channel map). */
function wholeVoiceHands(
  song: Pick<Song, 'notes' | 'noteIds'>,
  settings: HandSettings,
): CachedHands {
  const byId = new Map(song.notes.map((n) => [n.id, n]))
  let hands = ''
  const pitches: { midi: number }[] = []
  for (const id of song.noteIds) {
    const note = byId.get(id)
    const role = note === undefined ? 'hidden' : settings.roles[voiceId(note)]
    hands += role === 'right' ? 'R' : role === 'left' ? 'L' : '-'
    pitches.push({ midi: note?.midi ?? 0 })
  }
  return { hash: handsHash(settings), hands, summary: summariseHands(pitches, hands) }
}

/** The composers already in the library, each once, for matching an upload's composer. */
function libraryComposers(entries: readonly LibraryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.composer.trim()).filter((c) => c !== ''))]
}

function parseLastOpened(value: string): LastOpened | null {
  try {
    const parsed: unknown = JSON.parse(value)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { songId, bookmarkId, bar } = parsed as Record<string, unknown>
    if (typeof songId !== 'string') return null
    return {
      songId,
      bookmarkId: typeof bookmarkId === 'string' ? bookmarkId : null,
      ...(Number.isInteger(bar) && (bar as number) >= 0 ? { bar: bar as number } : {}),
    }
  } catch {
    return null
  }
}
