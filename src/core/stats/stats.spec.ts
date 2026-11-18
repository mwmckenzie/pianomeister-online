// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { PlayRecord } from './PlayRecord'
import { comparePractice } from './comparePractice'
import { formatPlayedTimes, formatPlays, formatShare } from './formatPlays'
import { formatPracticeTime } from './formatPracticeTime'
import { sessionize } from './sessionize'
import { NO_PRACTICE, practiceShare, totalsBy } from './sumPractice'
import { summariseProfile } from './summariseProfile'

const MIN = 60_000

function rec(
  songId: string,
  bookmarkId: string,
  startedAt: number,
  playedMs: number,
  passes = 0,
): PlayRecord {
  return {
    id: `${bookmarkId}@${startedAt}`,
    profileId: 'p',
    sessionId: 's',
    songId,
    bookmarkId,
    startedAt,
    playedMs,
    passes,
  }
}

const LOG = [
  rec('a', 'full:a', 0, 4 * MIN, 1),
  rec('a', 'b1', 5 * MIN, 6 * MIN, 3),
  rec('b', 'full:b', 60 * MIN, 10 * MIN, 0),
  rec('a', 'b1', 120 * MIN, 2 * MIN, 1),
]

describe('totals', () => {
  it('sums plays and time per song, Full song and bookmarks together', () => {
    const bySong = totalsBy(LOG, 'songId')
    expect(bySong.get('a')).toEqual({ plays: 5, playedMs: 12 * MIN, lastPlayedAt: 122 * MIN })
    expect(bySong.get('b')).toEqual({ plays: 0, playedMs: 10 * MIN, lastPlayedAt: 70 * MIN })
  })

  it('sums per entry, with each entry share of its song', () => {
    const byEntry = totalsBy(LOG, 'bookmarkId')
    const song = totalsBy(LOG, 'songId').get('a') ?? NO_PRACTICE
    expect(byEntry.get('b1')).toEqual({ plays: 4, playedMs: 8 * MIN, lastPlayedAt: 122 * MIN })
    expect(practiceShare(byEntry.get('b1') ?? NO_PRACTICE, song)).toBeCloseTo(8 / 12)
    expect(practiceShare(NO_PRACTICE, NO_PRACTICE)).toBeNull()
  })
})

describe('sessionize', () => {
  it('starts a new session after more than 10 minutes without playback', () => {
    const sessions = sessionize([
      rec('a', 'x', 0, MIN),
      rec('a', 'x', 11 * MIN, MIN),
      rec('a', 'x', 22 * MIN + 1, MIN),
    ])
    expect(sessions.map((s) => s.length)).toEqual([2, 1])
  })

  it('orders records first and measures gaps from the end of the previous playback', () => {
    const sessions = sessionize([rec('a', 'x', 30 * MIN, MIN), rec('a', 'x', 0, 25 * MIN)])
    expect(sessions).toHaveLength(1)
  })
})

describe('summariseProfile', () => {
  it('summarises sessions, songs, time, the most practiced song and the average session', () => {
    expect(summariseProfile(LOG)).toEqual({
      sessions: 3,
      songsPracticed: 2,
      playedMs: 22 * MIN,
      mostPracticedSongId: 'a',
      lastPlayedAt: 122 * MIN,
      averageSessionMs: (22 * MIN) / 3,
    })
  })

  it('is empty for no records', () => {
    expect(summariseProfile([])).toEqual({
      sessions: 0,
      songsPracticed: 0,
      playedMs: 0,
      mostPracticedSongId: null,
      lastPlayedAt: null,
      averageSessionMs: 0,
    })
  })
})

describe('formats', () => {
  it('formats practice time', () => {
    expect(formatPracticeTime(0)).toBe('—')
    expect(formatPracticeTime(20_000)).toBe('<1 min')
    expect(formatPracticeTime(14 * MIN)).toBe('14 min')
    expect(formatPracticeTime(65 * MIN)).toBe('1 h 5 min')
    expect(formatPracticeTime(120 * MIN)).toBe('2 h')
    expect(formatPracticeTime(260 * MIN)).toBe('4 h 20 min')
  })

  it('formats plays and shares', () => {
    expect(formatPlays(0)).toBe('—')
    expect(formatPlays(9)).toBe('9')
    expect(formatPlays(9, true)).toBe('9 plays')
    expect(formatPlays(1, true)).toBe('1 play')
    expect(formatPlayedTimes(23)).toBe('23×')
    expect(formatPlayedTimes(0)).toBe('—')
    expect(formatShare(0.4166)).toBe('42%')
    expect(formatShare(null)).toBe('—')
  })
})

describe('comparePractice', () => {
  const rows = {
    many: { plays: 9, playedMs: 5 * MIN, lastPlayedAt: 100, bookmarks: 1 },
    few: { plays: 2, playedMs: 30 * MIN, lastPlayedAt: 300, bookmarks: 3 },
    none: { plays: 0, playedMs: 0, lastPlayedAt: null, bookmarks: 0 },
  }
  const sorted = (field: 'plays' | 'time' | 'last' | 'bookmarks', direction: 'asc' | 'desc') =>
    (['none', 'few', 'many'] as const)
      .slice()
      .sort((a, b) => comparePractice(rows[a], rows[b], field, direction))

  it('puts the most, longest or most recent first when descending', () => {
    expect(sorted('plays', 'desc')).toEqual(['many', 'few', 'none'])
    expect(sorted('time', 'desc')).toEqual(['few', 'many', 'none'])
    expect(sorted('last', 'desc')).toEqual(['few', 'many', 'none'])
    expect(sorted('bookmarks', 'desc')).toEqual(['few', 'many', 'none'])
  })

  it('keeps rows with nothing to show last when ascending too', () => {
    expect(sorted('plays', 'asc')).toEqual(['few', 'many', 'none'])
    expect(sorted('last', 'asc')).toEqual(['many', 'few', 'none'])
  })

  it('treats a missing row like an empty one', () => {
    expect(comparePractice(undefined, rows.none, 'plays', 'desc')).toBe(0)
    expect(comparePractice(undefined, rows.few, 'plays', 'asc')).toBe(1)
  })
})
