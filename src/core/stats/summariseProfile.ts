import type { PlayRecord } from './PlayRecord'
import type { ProfileSummary } from './ProfileSummary'
import { totalsBy } from './sumPractice'
import { sessionize } from './sessionize'

/** Summary stats for one profile's play records. */
export function summariseProfile(records: readonly PlayRecord[]): ProfileSummary {
  const sessions = sessionize(records).length
  const bySong = totalsBy(records, 'songId')
  let playedMs = 0
  let lastPlayedAt: number | null = null
  let most: { songId: string; playedMs: number } | null = null
  for (const [songId, totals] of bySong) {
    playedMs += totals.playedMs
    if (totals.lastPlayedAt !== null)
      lastPlayedAt = Math.max(lastPlayedAt ?? 0, totals.lastPlayedAt)
    if (most === null || totals.playedMs > most.playedMs)
      most = { songId, playedMs: totals.playedMs }
  }
  return {
    sessions,
    songsPracticed: bySong.size,
    playedMs,
    mostPracticedSongId: most?.songId ?? null,
    lastPlayedAt,
    averageSessionMs: sessions > 0 ? playedMs / sessions : 0,
  }
}
