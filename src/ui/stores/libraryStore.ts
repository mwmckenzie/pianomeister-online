import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { handsPassMessage } from '@/core/hands/handsPassMessage'
import type { HandSettings } from '@/core/hands/HandSettings'
import { needsHandsCheck } from '@/core/hands/needsHandsCheck'
import { filterEntries } from '@/core/library/filterEntries'
import { groupEntries } from '@/core/library/groupEntries'
import type { LibraryEntry } from '@/core/library/LibraryEntry'
import type { LibrarySortField } from '@/core/library/LibrarySortField'
import type { ProfileChoice } from '@/core/library/ProfileChoice'
import { matchesSearch } from '@/core/library/matchesSearch'
import { normalizeTags } from '@/core/library/normalizeTags'
import type { SongMetaFields } from '@/core/library/SongMetaFields'
import type { SongSource } from '@/core/library/SongSource'
import { sortEntries } from '@/core/library/sortEntries'
import type { MeterOverride } from '@/core/timing/MeterOverride'
import { browserStorage } from '@/data/browserStorage'
import { fetchBundledSongs } from '@/data/fetchBundledSongs'
import type { HandDetails } from '@/data/HandDetails'
import type { ImportReport } from '@/data/ImportReport'
import type { LastOpened } from '@/data/LastOpened'
import { Library, type PreparedImport } from '@/data/Library'
import type { OpenedSong } from '@/data/OpenedSong'
import type { StorageStatus } from '@/data/StorageStatus'
import type { UploadFile } from '@/data/UploadFile'
import type { UploadResult } from '@/data/UploadResult'

import { HandsWorkerClient } from '../hands/HandsWorkerClient'
import { runHandsPass } from '../hands/runHandsPass'
import { whenIdle } from '../hands/whenIdle'
import { songIsPlaying } from '../playback/sharedSession'
import { appDatabase } from './appDatabase'
import { useBookmarkStore } from './bookmarkStore'
import { useProfileStore } from './profileStore'
import { useSettingsStore } from './settingsStore'
import { useStatsStore } from './statsStore'
import { useToastStore } from './toastStore'

const collator = new Intl.Collator(undefined, { sensitivity: 'base' })

/**
 * The song library for the UI: entries, list view state (kept while visiting the player), and
 * actions that write through the Library service and refresh the list.
 */
export const useLibraryStore = defineStore('library', () => {
  // The service and its Dexie database stay outside reactivity.
  const library = new Library(
    appDatabase(),
    fetchBundledSongs(import.meta.env.BASE_URL),
    browserStorage,
  )
  const profiles = useProfileStore()
  const stats = useStatsStore()
  const bookmarks = useBookmarkStore()
  const settings = useSettingsStore()
  const toasts = useToastStore()
  const handsWorker = new HandsWorkerClient()

  const entries = shallowRef<readonly LibraryEntry[]>([])
  const loaded = ref(false)
  const storage = ref<StorageStatus | null>(null)

  const search = ref('')
  const sortField = ref<LibrarySortField>('title')
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const groupBy = ref<'none' | 'composer' | 'tag'>('none')
  const tagFilter = ref<string[]>([])
  const sourceFilter = ref<SongSource | 'all'>('all')

  const allTags = computed(() =>
    normalizeTags(entries.value.flatMap((e) => e.tags)).sort((a, b) => collator.compare(a, b)),
  )

  const visible = computed(() =>
    sortEntries(
      filterEntries(
        entries.value.filter((e) => matchesSearch(e, search.value)),
        { tags: tagFilter.value, source: sourceFilter.value },
      ),
      sortField.value,
      sortDirection.value,
      stats.songRows,
    ),
  )

  const groups = computed(() => groupEntries(visible.value, groupBy.value))

  /** Started once, on the first load (uploads and imports always get current facts). */
  let factsChecked = false

  /**
   * Recomputes uploads whose stored facts predate FACTS_VERSION, in the background; the list
   * (and so the picker and library) updates as each one is saved.
   */
  function refreshStaleFacts(): void {
    if (factsChecked) return
    factsChecked = true
    library
      .refreshStaleFacts(async () => {
        entries.value = await library.entries()
      })
      .catch((e: unknown) => console.warn("[library] Couldn't update stored song facts:", e))
  }

  /** Detects a song's hands and stores them; false when the song is gone. */
  async function detect(songId: string): Promise<boolean> {
    const bytes = await library.songBytes(songId)
    const detected = await handsWorker.detect(bytes, settings.settings.hands.defaultAlgorithm)
    const saved = await library.saveDetection(songId, detected)
    if (saved) entries.value = await library.entries()
    return saved
  }

  /** New uploads, one after another, without holding the upload up. */
  async function detectUploads(results: readonly UploadResult[]): Promise<void> {
    if (!settings.settings.hands.detectOnUpload) return
    for (const result of results) {
      if (result.outcome !== 'added') continue
      try {
        await detect(result.songId)
      } catch (e) {
        console.warn(`[library] Couldn't detect the hands of ${result.fileName}:`, e)
      }
    }
  }

  /** Started once, on the first load. */
  let handsPassStarted = false

  /** Detects songs from before milestone 10.5 (or an older detector) in the background. */
  async function handsPass(): Promise<void> {
    if (handsPassStarted) return
    handsPassStarted = true
    const songIds = await library.songsToDetect()
    const quiet = await library.handsPassIsQuiet()
    const detected = new Set(
      await runHandsPass({
        songIds,
        isPlaying: songIsPlaying,
        idle: whenIdle,
        wait: () => new Promise((resolve) => setTimeout(resolve, 1000)),
        detect,
        onFailed: (songId, e) =>
          console.warn(`[library] Couldn't detect the hands of ${songId}:`, e),
      }),
    )
    await library.finishHandsPass()
    // The player's own songs were only given reasons: they don't count.
    const mine = entries.value.filter(
      (e) => detected.has(e.songId) && e.hands.source === 'detected',
    )
    const toCheck = mine.filter((e) => needsHandsCheck(e.hands, settings.settings.hands.hintBelow))
    const message = quiet ? null : handsPassMessage(mine.length, toCheck.length)
    if (message !== null) toasts.show(message)
  }

  async function refresh(): Promise<void> {
    await profiles.load()
    library.setProfile(profiles.activeId)
    entries.value = await library.entries()
    loaded.value = true
    refreshStaleFacts()
    handsPass().catch((e: unknown) => console.warn("[library] Couldn't detect hands:", e))
    // A tag may have disappeared with an edit or delete.
    const known = new Set(allTags.value.map((t) => t.toLocaleLowerCase()))
    tagFilter.value = tagFilter.value.filter((t) => known.has(t.toLocaleLowerCase()))
  }

  async function refreshStorage(): Promise<void> {
    storage.value = await browserStorage.status()
  }

  function toggleTag(tag: string): void {
    const key = tag.toLocaleLowerCase()
    const has = tagFilter.value.some((t) => t.toLocaleLowerCase() === key)
    tagFilter.value = has
      ? tagFilter.value.filter((t) => t.toLocaleLowerCase() !== key)
      : [...tagFilter.value, tag]
  }

  /** Runs a write, then refreshes the list. Throws on failure (callers report it). */
  async function write<T>(action: () => Promise<T>): Promise<T> {
    const result = await action()
    await refresh()
    return result
  }

  // Hand assignments and the last opened song are per profile.
  watch(
    () => profiles.activeId,
    (id) => {
      library.setProfile(id)
      if (loaded.value) void refresh()
    },
  )

  /** Bookmarks and stats can change with an import or a delete: reload them too. */
  async function refreshPractice(): Promise<void> {
    await profiles.refresh()
    await Promise.all([bookmarks.refresh(), stats.refresh()])
  }

  /** The last failed write, shown by the library and player until dismissed or a write succeeds. */
  const error = ref('')

  /** Logs a failure and keeps its message for the UI, so a failed write is never silent. */
  function reportError(what: string, e: unknown): void {
    const message = e instanceof Error ? e.message : String(e)
    console.error(`[library] Couldn't ${what}:`, e)
    error.value = `Couldn't ${what}: ${message}`
  }

  /**
   * For the edits the UI fires and forgets (metadata, hands, meter, delete): never throws.
   * Returns false when the write failed; the error is logged and shown.
   */
  async function persist(what: string, action: () => Promise<unknown>): Promise<boolean> {
    try {
      await write(action)
      error.value = ''
      return true
    } catch (e) {
      reportError(what, e)
      return false
    }
  }

  return {
    entries,
    loaded,
    storage,
    search,
    sortField,
    sortDirection,
    groupBy,
    tagFilter,
    sourceFilter,
    allTags,
    visible,
    groups,
    refresh,
    refreshStorage,
    toggleTag,
    error,
    reportError,
    clearError: (): void => {
      error.value = ''
    },
    openSong: async (songId: string): Promise<OpenedSong> => {
      await profiles.load()
      library.setProfile(profiles.activeId)
      return library.openSong(songId)
    },
    startEntry: async (): Promise<LastOpened> => {
      await profiles.load()
      library.setProfile(profiles.activeId)
      return library.startEntry()
    },
    lastOpened: async (): Promise<LastOpened | null> => {
      await profiles.load()
      library.setProfile(profiles.activeId)
      return library.lastOpened()
    },
    /** Remembers where playback stopped, for Welcome's Resume; never throws. */
    setStoppedBar: async (bar: number): Promise<void> => {
      try {
        await profiles.load()
        library.setProfile(profiles.activeId)
        await library.setStoppedBar(bar)
      } catch (e) {
        console.error("[library] Couldn't remember where playback stopped:", e)
      }
    },
    /** Remembers what the profile opened (startup reopens it); never throws. */
    setLastOpened: async (songId: string, bookmarkId: string | null): Promise<boolean> => {
      try {
        await library.setLastOpened(songId, bookmarkId)
        return true
      } catch (e) {
        reportError('remember the last song', e)
        return false
      }
    },
    upload: async (files: readonly UploadFile[]): Promise<UploadResult[]> => {
      const results = await write(() => library.upload(files))
      await refreshStorage()
      void detectUploads(results)
      return results
    },
    setMeta: (songId: string, fields: SongMetaFields) =>
      persist('save the song details', () => library.setMeta(songId, fields)),
    resetMeta: (songId: string) =>
      persist('reset the song details', () => library.resetMeta(songId)),
    /** A fresh title and composer guess from an upload's file; null if it can't be read. */
    guessMeta: async (songId: string) => {
      try {
        return await library.guessMeta(songId)
      } catch (e) {
        reportError('read the file', e)
        return null
      }
    },
    handDetails: async (songId: string): Promise<HandDetails> => {
      await profiles.load()
      library.setProfile(profiles.activeId)
      return library.handDetails(songId)
    },
    /** Saves the player's own hands; detection never changes them again. */
    setHands: (songId: string, next: HandSettings) =>
      persist('save the hands', async () => {
        const resolved = await handsWorker.resolve(await library.songBytes(songId), next)
        await library.setHands(songId, next, resolved)
      }),
    detectHands: (songId: string) => persist('detect the hands', () => detect(songId)),
    setOverride: (songId: string, override: MeterOverride) =>
      persist('save the meter override', () => library.setOverride(songId, override)),
    clearOverride: (songId: string) =>
      persist('clear the meter override', () => library.clearOverride(songId)),
    deleteUpload: async (songId: string, withPracticeData = false): Promise<boolean> => {
      const ok = await persist('delete the upload', () =>
        library.deleteUpload(songId, { withPracticeData }),
      )
      if (withPracticeData) await refreshPractice()
      await refreshStorage()
      return ok
    },
    exportArchive: (): Promise<Uint8Array> => library.exportArchive(),
    /** Reads a backup and finds colliding profiles; writes nothing. */
    prepareImport: (bytes: Uint8Array): Promise<PreparedImport> => library.prepareImport(bytes),
    applyImport: async (
      prepared: PreparedImport,
      choices: ReadonlyMap<string, ProfileChoice>,
    ): Promise<ImportReport> => {
      const report = await write(() => library.applyImport(prepared, choices))
      await refreshPractice()
      await refreshStorage()
      void detectUploads(report.uploads)
      return report
    },
  }
})
