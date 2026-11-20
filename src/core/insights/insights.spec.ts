// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { Bookmark } from '../practice/Bookmark'
import type { PlayRecord } from '../stats/PlayRecord'
import { bucketPractice } from './bucketPractice'
import { bucketUnitFor } from './bucketUnitFor'
import { greeting } from './greeting'
import { headlineStats } from './headlineStats'
import { heatmapLevel } from './heatmapLevel'
import { heatmapWeeks } from './heatmapWeeks'
import { pickHighlights } from './pickHighlights'
import { pickSuggestions } from './pickSuggestions'
import { playLogCsv } from './playLogCsv'
import { practiceByDay } from './practiceByDay'
import { practiceStreaks } from './practiceStreaks'
import { rangeWindows } from './rangeWindows'
import { tempoProgress } from './tempoProgress'
import { timeOfDayGrid } from './timeOfDayGrid'
import { topPractice } from './topPractice'
import { weekComparison } from './weekComparison'

const MIN = 60_000
const UTC = 'UTC'
/** Thursday 19 November 2026, 20:00 UTC. */
const NOW = Date.UTC(2026, 10, 19, 20)
const TODAY = '2026-11-19'
const MONDAY = 1

let next = 0
function rec(at: string, minutes: number, fields: Partial<PlayRecord> = {}): PlayRecord {
  return {
    id: `r${++next}`,
    profileId: 'p',
    sessionId: 's',
    songId: 'minuet',
    bookmarkId: 'full:minuet',
    startedAt: Date.parse(at),
    playedMs: minutes * MIN,
    plays: 1,
    ...fields,
  }
}

const days = (...keys: string[]) => new Set(keys)

describe('greeting', () => {
  it('greets by local hour, with the name', () => {
    expect(greeting(5, 'Matt')).toEqual({ text: 'Good morning', name: 'Matt' })
    expect(greeting(11, 'Matt').text).toBe('Good morning')
    expect(greeting(12, 'Matt').text).toBe('Good afternoon')
    expect(greeting(18, 'Matt').text).toBe('Good evening')
    expect(greeting(23, 'Matt').text).toBe('Good night')
    expect(greeting(4, 'Matt').text).toBe('Good night')
  })

  it('says "Welcome back" to a profile still named Me', () => {
    expect(greeting(20, 'Me')).toEqual({ text: 'Welcome back', name: null })
  })
})

describe('practiceStreaks', () => {
  it('counts back from today, or from yesterday before today is practised', () => {
    expect(practiceStreaks(days('2026-11-17', '2026-11-18', '2026-11-19'), TODAY).current).toBe(3)
    expect(practiceStreaks(days('2026-11-17', '2026-11-18'), TODAY).current).toBe(2)
    expect(practiceStreaks(days('2026-11-16', '2026-11-17'), TODAY).current).toBe(0)
  })

  it('finds the longest run across gaps and month ends', () => {
    const run = days('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-10')
    expect(practiceStreaks(run, TODAY)).toEqual({ current: 0, longest: 4 })
  })

  it('is unaffected by DST: local days across the October change are one run', () => {
    // Europe/Berlin leaves summer time on 25 Oct 2026 (a 25-hour day).
    const records = [
      rec('2026-10-24T18:00:00Z', 10),
      rec('2026-10-25T18:00:00Z', 10),
      rec('2026-10-26T18:00:00Z', 10),
    ]
    const byDay = practiceByDay(records, 'Europe/Berlin')
    expect([...byDay.keys()]).toEqual(['2026-10-24', '2026-10-25', '2026-10-26'])
    expect(practiceStreaks(new Set(byDay.keys()), '2026-10-26').current).toBe(3)
  })
})

describe('practiceByDay', () => {
  it('splits a stretch at local midnight', () => {
    const byDay = practiceByDay([rec('2026-11-18T23:30:00Z', 60)], UTC)
    expect(byDay.get('2026-11-18')).toBe(30 * MIN)
    expect(byDay.get('2026-11-19')).toBe(30 * MIN)
  })
})

describe('weekComparison', () => {
  const byDay = practiceByDay(
    [
      // This week (Mon 16 Nov – today Thu 19): 30 + 60 minutes.
      rec('2026-11-16T10:00:00Z', 30),
      rec('2026-11-19T10:00:00Z', 60),
      // Last week, Mon–Thu: 72 minutes; Saturday's 100 don't count (not the same days).
      rec('2026-11-10T10:00:00Z', 72),
      rec('2026-11-14T10:00:00Z', 100),
    ],
    UTC,
  )

  it('compares the calendar week so far with the same days of last week', () => {
    const week = weekComparison(byDay, TODAY, MONDAY)
    expect(week.thisWeekMs).toBe(90 * MIN)
    expect(week.lastWeekMs).toBe(72 * MIN)
    expect(week.change).toBeCloseTo(0.25)
    expect(week.days.map((d) => (d.ms === null ? null : d.ms / MIN))).toEqual([
      30,
      0,
      0,
      60,
      null,
      null,
      null,
    ])
  })

  it('follows the locale week start, and has no change without last week', () => {
    const sunday = weekComparison(byDay, TODAY, 0)
    expect(sunday.days[0]?.key).toBe('2026-11-15')
    expect(weekComparison(new Map(), TODAY, MONDAY).change).toBeNull()
  })
})

describe('heatmap', () => {
  it('shades by fixed minute thresholds', () => {
    expect([0, 1, 14, 15, 29, 30, 44, 45, 120].map((m) => heatmapLevel(m * MIN))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ])
  })

  it('lays out whole calendar weeks ending with this one, marking today and the future', () => {
    const weeks = heatmapWeeks(new Map([[TODAY, 50 * MIN]]), TODAY, 12, MONDAY)
    expect(weeks).toHaveLength(12)
    const last = weeks[11] ?? []
    expect(last[0]?.key).toBe('2026-11-16')
    expect(last[3]).toMatchObject({ key: TODAY, level: 4, today: true, future: false })
    expect(last[4]).toMatchObject({ future: true })
    expect(weeks[0]?.[0]?.key).toBe('2026-08-31')
  })
})

describe('rangeWindows and buckets', () => {
  it('rolls windows back from today, each with a previous one of the same length', () => {
    expect(rangeWindows('7d', TODAY, null)).toEqual({
      current: { from: '2026-11-13', to: TODAY, days: 7 },
      previous: { from: '2026-11-06', to: '2026-11-12', days: 7 },
    })
    expect(rangeWindows('30d', TODAY, null).current.from).toBe('2026-10-21')
    expect(rangeWindows('12m', TODAY, null).current).toEqual({
      from: '2025-11-20',
      to: TODAY,
      days: 365,
    })
    expect(rangeWindows('all', TODAY, '2026-02-01')).toEqual({
      current: { from: '2026-02-01', to: TODAY, days: 292 },
      previous: null,
    })
  })

  it('buckets by day, week or month, the last bucket being the current one', () => {
    const byDay = practiceByDay(
      [rec('2026-11-19T10:00:00Z', 20), rec('2026-11-02T10:00:00Z', 40)],
      UTC,
    )
    const month = rangeWindows('30d', TODAY, null).current
    expect(bucketUnitFor(month)).toBe('day')
    const perDay = bucketPractice(byDay, month, 'day', MONDAY)
    expect(perDay).toHaveLength(30)
    expect(perDay[29]).toEqual({ key: TODAY, ms: 20 * MIN, current: true })

    const year = rangeWindows('12m', TODAY, null).current
    expect(bucketUnitFor(year)).toBe('week')
    const perWeek = bucketPractice(byDay, year, 'week', MONDAY)
    expect(perWeek[perWeek.length - 1]).toEqual({ key: '2026-11-16', ms: 20 * MIN, current: true })
    expect(perWeek[0]?.key).toBe('2025-11-20')

    const all = rangeWindows('all', TODAY, '2024-03-10').current
    expect(bucketUnitFor(all)).toBe('month')
    const perMonth = bucketPractice(byDay, all, 'month', MONDAY)
    expect(perMonth[0]?.key).toBe('2024-03-10')
    expect(perMonth[perMonth.length - 1]).toEqual({
      key: '2026-11-01',
      ms: 60 * MIN,
      current: true,
    })
  })
})

describe('headlineStats', () => {
  it('sums the window: time, sessions, average, days, plays, longest streak', () => {
    const records = [
      rec('2026-11-17T10:00:00Z', 20, { plays: 3 }),
      rec('2026-11-17T10:25:00Z', 10, { plays: 1 }),
      rec('2026-11-18T10:00:00Z', 30, { plays: 2 }),
      rec('2026-11-19T10:00:00Z', 10, { plays: 1 }),
      // Outside the 7 days.
      rec('2026-11-01T10:00:00Z', 99, { plays: 9 }),
    ]
    const byDay = practiceByDay(records, UTC)
    const stats = headlineStats(records, byDay, rangeWindows('7d', TODAY, null).current, UTC)
    expect(stats).toEqual({
      playedMs: 70 * MIN,
      sessions: 3,
      averageSessionMs: (70 * MIN) / 3,
      daysPractised: 3,
      days: 7,
      plays: 7,
      longestStreak: 3,
    })
  })
})

describe('timeOfDayGrid', () => {
  it('splits by local weekday and band (morning 5–11 … night 23–5)', () => {
    // Thursday 10:30–11:30 UTC: half morning, half midday.
    const grid = timeOfDayGrid([rec('2026-11-19T10:30:00Z', 60)], UTC)
    expect(grid[4]?.[0]).toBe(30 * MIN)
    expect(grid[4]?.[1]).toBe(30 * MIN)
    // Saturday 23:30 → Sunday 00:30: night on both days.
    const late = timeOfDayGrid([rec('2026-11-21T23:30:00Z', 60)], UTC)
    expect(late[6]?.[4]).toBe(30 * MIN)
    expect(late[0]?.[4]).toBe(30 * MIN)
  })
})

describe('topPractice and tempoProgress', () => {
  it('ranks by time, songs or one song’s entries (other setups as null)', () => {
    const records = [
      rec('2026-11-19T10:00:00Z', 10, { bookmarkId: 'b1' }),
      rec('2026-11-19T11:00:00Z', 30, { bookmarkId: null }),
      rec('2026-11-19T12:00:00Z', 20, { songId: 'canon', bookmarkId: 'full:canon' }),
    ]
    expect(topPractice(records, (r) => r.songId)).toEqual([
      { key: 'minuet', ms: 40 * MIN },
      { key: 'canon', ms: 20 * MIN },
    ])
    expect(
      topPractice(
        records.filter((r) => r.songId === 'minuet'),
        (r) => r.bookmarkId,
      ).map((t) => t.key),
    ).toEqual([null, 'b1'])
  })

  it('takes the highest tempo per week on exactly that range, any setup', () => {
    const loop = { startBar: 17, endBar: 32 }
    const records = [
      rec('2026-11-03T10:00:00Z', 5, { loop, tempoPercent: 70 }),
      rec('2026-11-04T10:00:00Z', 5, { loop, tempoPercent: 75, bookmarkId: null }),
      rec('2026-11-17T10:00:00Z', 5, { loop, tempoPercent: 85 }),
      rec('2026-11-18T10:00:00Z', 5, { loop: { startBar: 1, endBar: 4 }, tempoPercent: 120 }),
      rec('2026-11-18T11:00:00Z', 5, { loop, tempoPercent: 80 }),
    ]
    expect(tempoProgress(records, 'minuet', loop, '2026-10-01', MONDAY, UTC)).toEqual([
      { week: '2026-11-02', tempo: 75 },
      { week: '2026-11-16', tempo: 85 },
    ])
  })
})

function bookmark(id: string, name: string, songId = 'minuet'): Bookmark {
  return {
    id,
    profileId: 'p',
    songId,
    name,
    autoName: false,
    config: {
      loop: { startBar: 17, endBar: 32 },
      tempoPercent: 85,
      handAudio: { right: 'on', left: 'on' },
      preRollBeats: 0,
      preRollMode: 'muted',
      metronomeMode: 'off',
    },
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('pickHighlights', () => {
  const loop = { startBar: 17, endBar: 32 }
  const title = (id: string) => ({ minuet: 'Minuet in G', canon: 'Canon in D' })[id] ?? id

  it('puts a tempo rise first, then the favourite song, the top bookmark and the longest session', () => {
    const records = [
      rec('2026-11-03T10:00:00Z', 20, { bookmarkId: 'b1', loop, tempoPercent: 70, plays: 4 }),
      rec('2026-11-17T10:00:00Z', 30, { bookmarkId: 'b1', loop, tempoPercent: 85, plays: 6 }),
      rec('2026-11-18T10:00:00Z', 15, { songId: 'canon', bookmarkId: 'full:canon' }),
    ]
    const highlights = pickHighlights({
      records,
      bookmarks: [bookmark('b1', 'B section')],
      songTitle: title,
      now: NOW,
      weekStart: MONDAY,
      timeZone: UTC,
    })
    expect(highlights.map((h) => h.kind)).toEqual([
      'tempo',
      'favouriteSong',
      'topBookmark',
      'longestSession',
    ])
    const tempo = highlights[0]
    expect(tempo?.title.map((p) => p.text).join('')).toBe(
      'B section went from 70% to 85% this month',
    )
    expect(tempo?.detail).toBe('Minuet in G · 10 plays since 3 Nov')
    expect(tempo?.trend).toEqual([70, 85])
    expect(highlights[1]?.title.map((p) => p.text).join('')).toBe(
      'Your favourite this month: Minuet in G',
    )
  })

  it('skips a rise under 5 points, and reports a time milestone passed this month', () => {
    const records = [
      rec('2026-01-10T10:00:00Z', 9.5 * 60, { bookmarkId: 'b1', loop, tempoPercent: 80 }),
      rec('2026-11-18T10:00:00Z', 60, { bookmarkId: 'b1', loop, tempoPercent: 83 }),
    ]
    const highlights = pickHighlights({
      records,
      bookmarks: [bookmark('b1', 'B section')],
      songTitle: title,
      now: NOW,
      weekStart: MONDAY,
      timeZone: UTC,
    })
    expect(highlights[0]?.kind).toBe('milestone')
    expect(highlights[0]?.title.map((p) => p.text).join('')).toBe('You passed 10 hours of practice')
    expect(highlights.some((h) => h.kind === 'tempo')).toBe(false)
  })

  it('has nothing without history', () => {
    expect(
      pickHighlights({
        records: [],
        bookmarks: [],
        songTitle: title,
        now: NOW,
        weekStart: MONDAY,
        timeZone: UTC,
      }),
    ).toEqual([])
  })
})

describe('pickSuggestions', () => {
  const songs = [
    { songId: 'minuet', title: 'Minuet in G' },
    { songId: 'canon', title: 'Canon in D' },
  ]

  it('suggests the most practised resting bookmark and a song never played', () => {
    const records = [
      rec('2026-11-01T10:00:00Z', 30, { bookmarkId: 'b1' }),
      rec('2026-11-02T10:00:00Z', 50, { bookmarkId: 'b2' }),
      // b3 was played yesterday: not resting.
      rec('2026-11-18T10:00:00Z', 90, { bookmarkId: 'b3' }),
    ]
    const suggestions = pickSuggestions({
      records,
      bookmarks: [bookmark('b1', 'A'), bookmark('b2', 'B'), bookmark('b3', 'C')],
      songs,
      now: NOW,
    })
    expect(suggestions).toEqual([
      expect.objectContaining({ kind: 'bookmark', songTitle: 'Minuet in G' }),
      { kind: 'song', songId: 'canon', title: 'Canon in D' },
    ])
    expect(suggestions[0]?.kind === 'bookmark' && suggestions[0].bookmark.id).toBe('b2')
  })

  it('never suggests the song the resume card already offers', () => {
    const suggestions = pickSuggestions({
      records: [],
      bookmarks: [],
      songs,
      now: NOW,
      exceptSongId: 'minuet',
    })
    expect(suggestions).toEqual([{ kind: 'song', songId: 'canon', title: 'Canon in D' }])
  })

  it('suggests nothing when every song is played and no bookmark rests', () => {
    expect(
      pickSuggestions({
        records: [
          rec('2026-11-18T10:00:00Z', 5),
          rec('2026-11-18T11:00:00Z', 5, { songId: 'canon' }),
        ],
        bookmarks: [],
        songs,
        now: NOW,
      }),
    ).toEqual([])
  })
})

describe('playLogCsv', () => {
  it('writes a header and one row per record in local time, escaped', () => {
    const records = [
      rec('2026-11-19T22:30:00Z', 12.5, {
        bookmarkId: 'b1',
        plays: 3,
        tempoPercent: 85,
        loop: { startBar: 17, endBar: 32 },
        handAudio: { right: 'on', left: 'muted' },
        preRollBeats: 2,
        preRollMode: 'quiet',
        metronomeMode: 'preRoll',
      }),
      rec('2026-11-18T10:00:00Z', 5, { bookmarkId: null, songId: 'canon' }),
      rec('2026-11-17T10:00:00Z', 5, { bookmarkId: 'gone' }),
    ]
    const csv = playLogCsv(
      records,
      {
        songTitle: (id) => (id === 'canon' ? 'Canon, in D' : 'Minuet "in G"'),
        bookmarkName: (id) => (id === 'b1' ? 'B section' : null),
      },
      'Europe/Berlin',
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(
      'Date,Time,Song,Bookmark,Minutes,Plays,Tempo %,Loop,Hands,Pre-roll,Metronome',
    )
    expect(lines[1]).toBe('2026-11-17,11:00,"Minuet ""in G""",Deleted bookmark,5.0,1,,,,,')
    expect(lines[2]).toBe('2026-11-18,11:00,"Canon, in D",Other setup,5.0,1,,,,,')
    // 22:30 UTC is already the next day in Berlin.
    expect(lines[3]).toBe(
      '2026-11-19,23:30,"Minuet ""in G""",B section,12.5,3,85,17–32,"right on, left muted",2 (quiet),in pre-roll',
    )
  })
})
