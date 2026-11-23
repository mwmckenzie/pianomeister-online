import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { dailyMinutes } from '@/core/stats/dailyMinutes'
import type { PlayRecord } from '@/core/stats/PlayRecord'
import type { PracticeRow } from '@/core/stats/PracticeRow'
import type { PracticeTotals } from '@/core/stats/PracticeTotals'
import type { RecorderWrite } from '@/core/stats/RecorderWrite'
import { NO_PRACTICE, otherSetupTotals, practiceShare, totalsBy } from '@/core/stats/sumPractice'
import { sessionGapMs } from '@/core/stats/sessionGapMs'
import { summariseProfile } from '@/core/stats/summariseProfile'
import { PlayLog } from '@/data/PlayLog'

import { appDatabase } from './appDatabase'
import { useBookmarkStore } from './bookmarkStore'
import { useProfileStore } from './profileStore'
import { useSettingsStore } from './settingsStore'

/** Days in the practice charts (brief decision 71). */
export const CHART_DAYS = 14

/**
 * The active profile's play log and the stats computed from it (brief decisions 70–71). The
 * recorder's writes go through here, so the stats update as you practise.
 */
export const useStatsStore = defineStore('stats', () => {
  const log = new PlayLog(appDatabase())
  const profiles = useProfileStore()
  const bookmarks = useBookmarkStore()
  const records = shallowRef<readonly PlayRecord[]>([])
  const settings = useSettingsStore()
  /** The "New session after" setting in ms: the one session rule (milestone 9.2). */
  const gapMs = computed(() => sessionGapMs(settings.settings.appearance))
  /**
   * Tracking suspended (for playlist mode, 9.5; nothing turns it on yet): while on, nothing is
   * recorded and the session timer (Home on a new session) is paused.
   */
  const trackingSuspended = ref(false)
  /** The transport is playing (the play log follows it). */
  const playbackActive = ref(false)
  /**
   * When the active profile's playback last ended: the stored last session's end, then kept
   * current by the play log; null if it never played. `lastEndKnown` once it has been read.
   */
  const lastPlaybackEnd = ref<number | null>(null)
  const lastEndKnown = ref(false)
  /** "Today" for the charts and "last practiced"; moves on with every write and each minute. */
  const now = ref(Date.now())
  setInterval(() => (now.value = Date.now()), 60_000)

  async function refresh(): Promise<void> {
    await profiles.load()
    records.value = await log.records(profiles.activeId)
    now.value = Date.now()
  }

  // Loaded on first use, and again for each profile.
  watch(
    () => profiles.activeId,
    () => void refresh(),
    { immediate: true },
  )

  /** Stores a recorder write and shows it at once (a stretch is rewritten as it grows). */
  async function record(write: RecorderWrite): Promise<void> {
    if (write.record.profileId === profiles.activeId) {
      const others = records.value.filter((r) => r.id !== write.record.id)
      records.value = [...others, write.record]
      now.value = Date.now()
    }
    await log.write(write)
  }

  const bySong = computed(() => totalsBy(records.value, 'songId'))
  const byEntry = computed(() => totalsBy(records.value, 'bookmarkId'))
  const byOtherSetups = computed(() => otherSetupTotals(records.value))

  /** Per song: totals plus bookmark count, for the practice columns and their sorting. */
  const songRows = computed(() => {
    const rows = new Map<string, PracticeRow>()
    const songIds = new Set([...bySong.value.keys(), ...bookmarks.bySong.keys()])
    for (const songId of songIds) {
      rows.set(songId, {
        ...(bySong.value.get(songId) ?? NO_PRACTICE),
        bookmarks: bookmarks.forSong(songId).length,
      })
    }
    return rows
  })

  const summary = computed(() => summariseProfile(records.value, gapMs.value))

  function song(songId: string): PracticeTotals {
    return bySong.value.get(songId) ?? NO_PRACTICE
  }

  /** A bookmark's or Full song's totals (entry id: a bookmark id or `full:<songId>`). */
  function entry(entryId: string): PracticeTotals {
    return byEntry.value.get(entryId) ?? NO_PRACTICE
  }

  /** A song's plays and time on setups that matched no bookmark and not Full song. */
  function otherSetups(songId: string): PracticeTotals {
    return byOtherSetups.value.get(songId) ?? NO_PRACTICE
  }

  function share(entryId: string, songId: string): number | null {
    return practiceShare(entry(entryId), song(songId))
  }

  /** Minutes per day for the last 14 days, today last: for a song or one entry. */
  function chart(filter: { readonly songId: string } | { readonly entryId: string }): number[] {
    const selected = records.value.filter((r) =>
      'songId' in filter ? r.songId === filter.songId : r.bookmarkId === filter.entryId,
    )
    return [...dailyMinutes(selected, CHART_DAYS, now.value)]
  }

  /** Practice time and last practice per profile id, for the Profiles tab. */
  async function totalsByProfile(): Promise<ReadonlyMap<string, PracticeTotals>> {
    const all = await log.allRecords()
    const totals = new Map<string, PracticeTotals>()
    const byProfile = new Map<string, PlayRecord[]>()
    for (const r of all) byProfile.set(r.profileId, [...(byProfile.get(r.profileId) ?? []), r])
    for (const [profileId, list] of byProfile) {
      const summary = summariseProfile(list, gapMs.value)
      totals.set(profileId, {
        plays: 0,
        playedMs: summary.playedMs,
        lastPlayedAt: summary.lastPlayedAt,
      })
    }
    return totals
  }

  /** The active profile's last session, which the next playback may continue. */
  function lastSession() {
    return log.lastSession(profiles.activeId)
  }

  return {
    records,
    now,
    refresh,
    record,
    bySong,
    byEntry,
    songRows,
    summary,
    song,
    entry,
    otherSetups,
    share,
    chart,
    lastSession,
    totalsByProfile,
    gapMs,
    trackingSuspended,
    playbackActive,
    lastPlaybackEnd,
    lastEndKnown,
  }
})
