import type { PlayRecord } from '../stats/PlayRecord'
import type { LoopRange } from '../transport/LoopRange'
import { dayKeyOf } from './dayKeyOf'
import { weekStartKey } from './weekStartKey'

/**
 * Tempo progress for a bar range (m7-7 decision 20): per calendar week (from the day key
 * `from`), the highest tempo % played on that song with exactly that loop, whatever else the
 * setup was. Weeks without such play are left out. Oldest first.
 */
export function tempoProgress(
  records: readonly PlayRecord[],
  songId: string,
  loop: LoopRange,
  from: string,
  weekStart: number,
  timeZone?: string,
): readonly { readonly week: string; readonly tempo: number }[] {
  const keyOf = dayKeyOf(timeZone)
  const best = new Map<string, number>()
  for (const r of records) {
    if (r.songId !== songId || r.tempoPercent === undefined || r.loop == null) continue
    if (r.loop.startBar !== loop.startBar || r.loop.endBar !== loop.endBar) continue
    const day = keyOf(r.startedAt)
    if (day < from) continue
    const week = weekStartKey(day, weekStart)
    best.set(week, Math.max(best.get(week) ?? 0, r.tempoPercent))
  }
  return [...best]
    .map(([week, tempo]) => ({ week, tempo }))
    .sort((a, b) => (a.week < b.week ? -1 : 1))
}
