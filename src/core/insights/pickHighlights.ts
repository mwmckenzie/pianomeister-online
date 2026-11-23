import { formatPracticeTime } from '../stats/formatPracticeTime'
import { sessionize } from '../stats/sessionize'
import { dayKeyOf } from './dayKeyOf'
import type { Highlight } from './Highlight'
import type { HighlightInput } from './HighlightInput'
import { shiftDayKey } from './shiftDayKey'
import { weekStartKey } from './weekStartKey'

const HOUR = 3_600_000
const TIME_MILESTONES = [100, 50, 25, 10].map((h) => h * HOUR)
const PLAY_MILESTONES = [1000, 500, 100]
/** At most this many highlights rotate (m7-7 decision 9). */
const MAX = 5

/** "3 Nov": a short local date. */
function shortDate(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone }).format(ms)
}

/**
 * A bookmark's range played faster: the highest tempo on its first practised day of the last 30
 * days against the highest since, at least 5 points up. Biggest rise first.
 */
function tempoRises(input: HighlightInput, since: string, keyOf: (ms: number) => string) {
  const out: { rise: number; highlight: Highlight }[] = []
  for (const b of input.bookmarks) {
    const played = input.records
      .filter(
        (r) =>
          r.songId === b.songId &&
          r.tempoPercent !== undefined &&
          r.loop != null &&
          r.loop.startBar === b.config.loop.startBar &&
          r.loop.endBar === b.config.loop.endBar &&
          keyOf(r.startedAt) >= since,
      )
      .sort((x, y) => x.startedAt - y.startedAt)
    if (played.length < 2) continue
    const byDay = new Map<string, number>()
    for (const r of played) {
      const day = keyOf(r.startedAt)
      byDay.set(day, Math.max(byDay.get(day) ?? 0, r.tempoPercent ?? 0))
    }
    const trend = [...byDay.values()]
    const from = trend[0] ?? 0
    const to = Math.max(...trend)
    if (to - from < 5) continue
    const plays = played.reduce((n, r) => n + r.plays, 0)
    const first = played[0]?.startedAt ?? input.now
    out.push({
      rise: to - from,
      highlight: {
        kind: 'tempo',
        title: [
          { text: `${b.name} went from ` },
          { text: `${from}%`, accent: true },
          { text: ' to ' },
          { text: `${to}%`, accent: true },
          { text: ' this month' },
        ],
        detail: `${input.songTitle(b.songId)} · ${plays} ${plays === 1 ? 'play' : 'plays'} since ${shortDate(first, input.timeZone)}`,
        trend,
      },
    })
  }
  return out.sort((x, y) => y.rise - x.rise).map((x) => x.highlight)
}

/** A total-time or total-plays milestone passed in the last 30 days. */
function milestone(input: HighlightInput, sinceMs: number): Highlight | null {
  const sorted = [...input.records].sort((a, b) => a.startedAt - b.startedAt)
  let ms = 0
  let plays = 0
  let reached: { label: string; at: number; value: number } | null = null
  for (const r of sorted) {
    const msBefore = ms
    const playsBefore = plays
    ms += r.playedMs
    plays += r.plays
    const end = r.startedAt + r.playedMs
    for (const mark of TIME_MILESTONES) {
      if (msBefore < mark && ms >= mark && (reached === null || mark / HOUR >= reached.value))
        reached = { label: `${mark / HOUR} hours of practice`, at: end, value: mark / HOUR }
    }
    for (const mark of PLAY_MILESTONES) {
      if (playsBefore < mark && plays >= mark && reached === null)
        reached = { label: `${mark} plays`, at: end, value: 0 }
    }
  }
  if (reached === null || reached.at < sinceMs) return null
  return {
    kind: 'milestone',
    title: [{ text: 'You passed ' }, { text: reached.label, accent: true }],
    detail: `Reached ${shortDate(reached.at, input.timeZone)}`,
  }
}

/**
 * Welcome's highlights (m7-7 decision 9): only those with data, at most five, most interesting
 * first — tempo progress, a milestone, the favourite song this month, the most practised
 * bookmark this week, the longest session this month.
 */
export function pickHighlights(input: HighlightInput): readonly Highlight[] {
  const keyOf = dayKeyOf(input.timeZone)
  const today = keyOf(input.now)
  const monthStart = today.slice(0, 8) + '01'
  const weekStart = weekStartKey(today, input.weekStart)
  const since30 = shiftDayKey(today, -29)
  const out: Highlight[] = [...tempoRises(input, since30, keyOf)]

  const passed = milestone(input, input.now - 30 * 86_400_000)
  if (passed !== null) out.push(passed)

  const thisMonth = input.records.filter((r) => keyOf(r.startedAt) >= monthStart)
  const songTime = new Map<string, number>()
  for (const r of thisMonth) songTime.set(r.songId, (songTime.get(r.songId) ?? 0) + r.playedMs)
  const favourite = [...songTime].sort((a, b) => b[1] - a[1])[0]
  if (favourite !== undefined) {
    out.push({
      kind: 'favouriteSong',
      title: [
        { text: 'Your favourite this month: ' },
        { text: input.songTitle(favourite[0]), accent: true },
      ],
      detail: `${formatPracticeTime(favourite[1])} this month`,
    })
  }

  const thisWeek = input.records.filter(
    (r) =>
      r.bookmarkId !== null && !r.bookmarkId.startsWith('full:') && keyOf(r.startedAt) >= weekStart,
  )
  const bookmarkTime = new Map<string, { ms: number; plays: number }>()
  for (const r of thisWeek) {
    const id = r.bookmarkId ?? ''
    const t = bookmarkTime.get(id) ?? { ms: 0, plays: 0 }
    bookmarkTime.set(id, { ms: t.ms + r.playedMs, plays: t.plays + r.plays })
  }
  const top = [...bookmarkTime]
    .filter(([id]) => input.bookmarks.some((b) => b.id === id))
    .sort((a, b) => b[1].ms - a[1].ms)[0]
  const topBookmark = top === undefined ? undefined : input.bookmarks.find((b) => b.id === top[0])
  if (top !== undefined && topBookmark !== undefined) {
    out.push({
      kind: 'topBookmark',
      title: [{ text: 'Most practised this week: ' }, { text: topBookmark.name, accent: true }],
      detail: `${input.songTitle(topBookmark.songId)} · ${formatPracticeTime(top[1].ms)} · ${top[1].plays} ${top[1].plays === 1 ? 'play' : 'plays'}`,
    })
  }

  const sessions = sessionize(thisMonth, input.gapMs)
  let longest: { ms: number; at: number } | null = null
  for (const s of sessions) {
    const ms = s.reduce((n, r) => n + r.playedMs, 0)
    if (longest === null || ms > longest.ms) longest = { ms, at: s[0]?.startedAt ?? 0 }
  }
  if (longest !== null && longest.ms >= 60_000) {
    out.push({
      kind: 'longestSession',
      title: [
        { text: 'Longest session this month: ' },
        { text: formatPracticeTime(longest.ms), accent: true },
      ],
      detail: `On ${shortDate(longest.at, input.timeZone)}`,
    })
  }
  return out.slice(0, MAX)
}
