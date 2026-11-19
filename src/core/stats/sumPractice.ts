import type { PlayRecord } from './PlayRecord'
import type { PracticeTotals } from './PracticeTotals'

export const NO_PRACTICE: PracticeTotals = { plays: 0, playedMs: 0, lastPlayedAt: null }

function add(totals: PracticeTotals, record: PlayRecord): PracticeTotals {
  const end = record.startedAt + record.playedMs
  return {
    plays: totals.plays + record.plays,
    playedMs: totals.playedMs + record.playedMs,
    lastPlayedAt: totals.lastPlayedAt === null ? end : Math.max(totals.lastPlayedAt, end),
  }
}

/**
 * Totals per song (`songId`: every record of the song — bookmarks, Full song, other setups, and
 * bookmarks since deleted; brief decision 71) or per entry (`bookmarkId`: one bookmark or Full
 * song, only the records that matched it exactly; other setups have no entry). Never stored:
 * always summed from the log.
 */
export function totalsBy(
  records: readonly PlayRecord[],
  key: 'songId' | 'bookmarkId',
): ReadonlyMap<string, PracticeTotals> {
  const totals = new Map<string, PracticeTotals>()
  for (const record of records) {
    const id = record[key]
    if (id === null) continue
    totals.set(id, add(totals.get(id) ?? NO_PRACTICE, record))
  }
  return totals
}

/** Per song: the records that matched no bookmark and not Full song ("other setups"). */
export function otherSetupTotals(
  records: readonly PlayRecord[],
): ReadonlyMap<string, PracticeTotals> {
  return totalsBy(
    records.filter((r) => r.bookmarkId === null),
    'songId',
  )
}

/** An entry's share of its song's practice time (0–1), or null when the song has none. */
export function practiceShare(entry: PracticeTotals, song: PracticeTotals): number | null {
  return song.playedMs > 0 ? entry.playedMs / song.playedMs : null
}
