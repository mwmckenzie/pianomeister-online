import type { PlayRecord } from '../stats/PlayRecord'

/**
 * Practice time per key, most first (m7-7 decision 17): per song, or — for one song's records —
 * per entry (a bookmark id, `full:<songId>`, or null for other setups).
 */
export function topPractice<K extends string | null>(
  records: readonly PlayRecord[],
  keyOf: (record: PlayRecord) => K,
): readonly { readonly key: K; readonly ms: number }[] {
  const totals = new Map<K, number>()
  for (const r of records) {
    const key = keyOf(r)
    totals.set(key, (totals.get(key) ?? 0) + r.playedMs)
  }
  return [...totals]
    .map(([key, ms]) => ({ key, ms }))
    .filter((t) => t.ms > 0)
    .sort((a, b) => b.ms - a.ms)
}
