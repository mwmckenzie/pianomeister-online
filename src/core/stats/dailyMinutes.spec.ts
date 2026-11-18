// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { PlayRecord } from './PlayRecord'
import { dailyMinutes } from './dailyMinutes'

const MIN = 60_000

function rec(startedAt: number, playedMs: number): PlayRecord {
  return {
    id: String(startedAt),
    profileId: 'p',
    sessionId: 's',
    songId: 'song',
    bookmarkId: 'full:song',
    startedAt,
    playedMs,
    passes: 0,
  }
}

const utc = (iso: string) => Date.parse(iso)

describe('dailyMinutes', () => {
  it('returns one value per day, oldest first and today last', () => {
    const now = utc('2026-11-18T12:00:00Z')
    const minutes = dailyMinutes(
      [rec(utc('2026-11-18T08:00:00Z'), 14 * MIN), rec(utc('2026-11-16T08:00:00Z'), 5 * MIN)],
      14,
      now,
      'UTC',
    )
    expect(minutes).toHaveLength(14)
    expect(minutes[13]).toBe(14)
    expect(minutes[11]).toBe(5)
    expect(minutes.reduce((a, b) => a + b, 0)).toBe(19)
  })

  it('ignores records outside the window', () => {
    const now = utc('2026-11-18T12:00:00Z')
    expect(
      dailyMinutes([rec(utc('2026-10-01T08:00:00Z'), 30 * MIN)], 14, now, 'UTC').every(
        (m) => m === 0,
      ),
    ).toBe(true)
  })

  it('splits a stretch at local midnight', () => {
    const now = utc('2026-11-18T12:00:00Z')
    // 23:50 → 00:20 in Berlin (UTC+1 in November): 10 minutes one day, 20 the next.
    const minutes = dailyMinutes(
      [rec(utc('2026-11-17T22:50:00Z'), 30 * MIN)],
      3,
      now,
      'Europe/Berlin',
    )
    expect(minutes).toEqual([0, 10, 20])
  })

  it('counts calendar days in the given time zone', () => {
    const now = utc('2026-11-18T12:00:00Z')
    // 23:30 UTC on the 17th is already the 18th in Tokyo.
    expect(dailyMinutes([rec(utc('2026-11-17T23:30:00Z'), 10 * MIN)], 2, now, 'UTC')).toEqual([
      10, 0,
    ])
    expect(
      dailyMinutes([rec(utc('2026-11-17T23:30:00Z'), 10 * MIN)], 2, now, 'Asia/Tokyo'),
    ).toEqual([0, 10])
  })

  it('keeps one bar per day across the spring DST change (a 23-hour day)', () => {
    // Berlin: 29 March 2026 has 23 hours. Practice at 00:30 local on the 30th, 15 min.
    const now = utc('2026-03-30T10:00:00Z')
    const minutes = dailyMinutes(
      [rec(utc('2026-03-29T22:30:00Z'), 15 * MIN), rec(utc('2026-03-29T08:00:00Z'), 5 * MIN)],
      3,
      now,
      'Europe/Berlin',
    )
    expect(minutes).toEqual([0, 5, 15])
  })

  it('keeps one bar per day across the autumn DST change (a 25-hour day)', () => {
    // Berlin: 25 October 2026 has 25 hours. A stretch over its midnight is split there.
    const now = utc('2026-10-26T10:00:00Z')
    const minutes = dailyMinutes(
      [rec(utc('2026-10-25T22:40:00Z'), 30 * MIN)],
      3,
      now,
      'Europe/Berlin',
    )
    // 23:40 → 00:10 local (UTC+1 after the change): 20 minutes on the 25th, 10 on the 26th.
    expect(minutes).toEqual([0, 20, 10])
  })
})
