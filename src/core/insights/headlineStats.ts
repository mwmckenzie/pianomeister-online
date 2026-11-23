import type { PlayRecord } from '../stats/PlayRecord'
import { sessionize } from '../stats/sessionize'
import type { HeadlineNumbers } from './HeadlineNumbers'
import { practiceStreaks } from './practiceStreaks'
import type { RangeWindow } from './RangeWindow'
import { recordsInWindow } from './recordsInWindow'

/**
 * The headline numbers for a window. Time and days practised come from the per-day split (a
 * stretch over midnight counts on both days); plays and sessions count where they started; the
 * average session is the window's time over its sessions.
 */
export function headlineStats(
  records: readonly PlayRecord[],
  byDay: ReadonlyMap<string, number>,
  window: RangeWindow,
  timeZone?: string,
  gapMs?: number,
): HeadlineNumbers {
  const days = new Set<string>()
  let playedMs = 0
  for (const [key, ms] of byDay) {
    if (key < window.from || key > window.to || ms <= 0) continue
    days.add(key)
    playedMs += ms
  }
  const started = recordsInWindow(records, window, timeZone)
  const sessions = sessionize(started, gapMs).length
  return {
    playedMs,
    sessions,
    averageSessionMs: sessions > 0 ? playedMs / sessions : 0,
    daysPractised: days.size,
    days: window.days,
    plays: started.reduce((n, r) => n + r.plays, 0),
    longestStreak: practiceStreaks(days, window.to).longest,
  }
}
