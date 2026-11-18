// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { PlayRecorder } from './PlayRecorder'
import type { RecorderEntry, RecorderEvent } from './RecorderEvent'
import type { RecorderWrite } from './RecorderWrite'
import type { Session } from './Session'

const BOOKMARK: RecorderEntry = { profileId: 'p1', songId: 's1', entryId: 'b1' }
const FULL: RecorderEntry = { profileId: 'p1', songId: 's1', entryId: 'full:s1' }
const MIN = 60_000

function recorder(lastSession: Session | null = null) {
  let next = 0
  const r = new PlayRecorder(() => `id${++next}`, lastSession)
  const writes: RecorderWrite[] = []
  const send = (event: RecorderEvent) => {
    const write = r.handle(event)
    if (write !== null) writes.push(write)
    return write
  }
  /** The latest version of each record, in the order they were first written. */
  const records = () => {
    const byId = new Map(writes.map((w) => [w.record.id, w.record]))
    return [...byId.values()]
  }
  return { r, send, writes, records }
}

const play = (now: number, atRangeStart = true, rangeMatches = true): RecorderEvent => ({
  type: 'play',
  atRangeStart,
  rangeMatches,
  now,
})

describe('PlayRecorder', () => {
  it('records nothing before an entry is loaded', () => {
    const { send, writes } = recorder()
    send(play(0))
    send({ type: 'pause', now: 5000 })
    expect(writes).toEqual([])
  })

  it('writes one record per stretch, with wall-clock time and the loaded entry', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(1000))
    send({ type: 'pause', now: 61_000 })
    expect(records()).toEqual([
      {
        id: 'id2',
        profileId: 'p1',
        sessionId: 'id1',
        songId: 's1',
        bookmarkId: 'b1',
        startedAt: 1000,
        playedMs: 60_000,
        passes: 0,
        tempoPercent: 100,
        loop: null,
        metronomeMode: 'off',
        temporary: false,
      },
    ])
  })

  it('rewrites the same record on every tick, so a crash loses at most one interval', () => {
    const { send, writes } = recorder()
    send({ type: 'load', entry: FULL, now: 0 })
    send(play(0))
    send({ type: 'tick', now: 30_000 })
    send({ type: 'tick', now: 60_000 })
    expect(writes.map((w) => [w.record.id, w.record.playedMs])).toEqual([
      ['id2', 30_000],
      ['id2', 60_000],
    ])
    expect(writes[1]?.session.endedAt).toBe(60_000)
  })

  it('ignores ticks while paused and a second play while playing', () => {
    const { send, writes } = recorder()
    send({ type: 'load', entry: FULL, now: 0 })
    send({ type: 'tick', now: 30_000 })
    send(play(40_000))
    send(play(45_000))
    send({ type: 'stop', now: 50_000 })
    expect(writes).toHaveLength(1)
    expect(writes[0]?.record.playedMs).toBe(10_000)
  })

  it('counts each loop wrap after a pass that started at the range start', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'wrap', now: 20_000 })
    send({ type: 'wrap', now: 40_000 })
    send({ type: 'pause', now: 50_000 })
    expect(records()[0]).toMatchObject({ passes: 2, playedMs: 50_000 })
  })

  it('counts pre-roll time: the stretch starts when playback starts', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    // Playback starts with a 3 s pre-roll; the first wrap comes after pre-roll + one pass.
    send(play(0))
    send({ type: 'wrap', now: 23_000 })
    send({ type: 'pause', now: 23_000 })
    expect(records()[0]).toMatchObject({ passes: 1, playedMs: 23_000 })
  })

  it("doesn't count a pass that started mid-range, but counts the next one", () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0, false))
    send({ type: 'wrap', now: 10_000 })
    send({ type: 'wrap', now: 30_000 })
    send({ type: 'stop', now: 31_000 })
    expect(records()[0]?.passes).toBe(1)
  })

  it('keeps a pass going across pause and resume', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'pause', now: 10_000 })
    send(play(20_000, false))
    send({ type: 'wrap', now: 30_000 })
    send({ type: 'pause', now: 31_000 })
    expect(records().map((r) => [r.playedMs, r.passes])).toEqual([
      [10_000, 0],
      [11_000, 1],
    ])
  })

  it('voids the pass in progress on a seek, unless the seek goes to the range start', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'seek', atRangeStart: false, now: 5000 })
    send({ type: 'wrap', now: 10_000 })
    send({ type: 'seek', atRangeStart: false, now: 12_000 })
    send({ type: 'seek', atRangeStart: true, now: 13_000 })
    send({ type: 'wrap', now: 33_000 })
    send({ type: 'pause', now: 33_000 })
    expect(records()[0]?.passes).toBe(1)
  })

  it('counts the song end as a pass of Full song played from the start', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: FULL, now: 0 })
    send(play(0))
    send({ type: 'end', now: 90_000 })
    send(play(100_000, false))
    send({ type: 'end', now: 110_000 })
    expect(records().map((r) => r.passes)).toEqual([1, 0])
  })

  describe('passes count only while the range equals the saved one', () => {
    it('a temporary range change counts time but no passes', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send(play(0, true, false))
      send({ type: 'wrap', now: 10_000 })
      send({ type: 'wrap', now: 20_000 })
      send({ type: 'pause', now: 25_000 })
      expect(records()[0]).toMatchObject({ bookmarkId: 'b1', playedMs: 25_000, passes: 0 })
    })

    it('changing the range mid-play voids the pass and stops counting until it matches again', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send(play(0))
      send({ type: 'wrap', now: 10_000 })
      send({ type: 'range', matchesSaved: false, now: 12_000 })
      send({ type: 'wrap', now: 20_000 })
      send({ type: 'range', matchesSaved: true, now: 22_000 })
      // The pass in progress when the range was restored is incomplete…
      send({ type: 'wrap', now: 30_000 })
      // …the next one counts.
      send({ type: 'wrap', now: 40_000 })
      send({ type: 'pause', now: 40_000 })
      expect(records()[0]).toMatchObject({ playedMs: 40_000, passes: 2 })
    })

    it('a temporary loop on Full song counts toward Full song, time only', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: FULL, now: 0 })
      send(play(0, true, false))
      send({ type: 'wrap', now: 10_000 })
      send({ type: 'stop', now: 10_000 })
      expect(records()[0]).toMatchObject({ bookmarkId: 'full:s1', passes: 0, playedMs: 10_000 })
    })

    it('temporary tempo or hand changes still count: they never reach the recorder', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send(play(0))
      send({ type: 'wrap', now: 30_000 })
      send({ type: 'pause', now: 30_000 })
      expect(records()[0]?.passes).toBe(1)
    })
  })

  it('ends the stretch when another entry loads mid-pass, without counting it', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'load', entry: FULL, now: 5000 })
    send(play(6000))
    send({ type: 'pause', now: 8000 })
    expect(records().map((r) => [r.bookmarkId, r.playedMs, r.passes])).toEqual([
      ['b1', 5000, 0],
      ['full:s1', 2000, 0],
    ])
  })

  it('ends the stretch when the tab is hidden and starts a new one when shown while playing', () => {
    const { send, records } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'hidden', now: 10_000 })
    send({ type: 'visible', playing: true, now: 70_000 })
    send({ type: 'wrap', now: 80_000 })
    send({ type: 'pause', now: 90_000 })
    expect(records().map((r) => [r.startedAt, r.playedMs, r.passes])).toEqual([
      [0, 10_000, 0],
      [70_000, 20_000, 1],
    ])
  })

  it('does not double count: a pass is written once, however many writes follow', () => {
    const { send, records, writes } = recorder()
    send({ type: 'load', entry: BOOKMARK, now: 0 })
    send(play(0))
    send({ type: 'wrap', now: 20_000 })
    send({ type: 'tick', now: 30_000 })
    send({ type: 'tick', now: 60_000 })
    send({ type: 'pause', now: 61_000 })
    expect(writes.length).toBeGreaterThan(1)
    expect(records()).toHaveLength(1)
    expect(records()[0]?.passes).toBe(1)
  })

  describe('sessions', () => {
    it('joins stretches less than 10 minutes apart into one session', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send(play(0))
      send({ type: 'pause', now: MIN })
      send(play(MIN + 10 * MIN))
      send({ type: 'pause', now: 12 * MIN })
      const [first, second] = records()
      expect(second?.sessionId).toBe(first?.sessionId)
    })

    it('starts a new session after more than 10 minutes without playback', () => {
      const { send, writes } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send(play(0))
      send({ type: 'pause', now: MIN })
      send(play(MIN + 10 * MIN + 1))
      send({ type: 'pause', now: 13 * MIN })
      expect(writes[1]?.session.id).not.toBe(writes[0]?.session.id)
      expect(writes[1]?.session).toMatchObject({ startedAt: 11 * MIN + 1, endedAt: 13 * MIN })
      expect(writes[0]?.session.endedAt).toBe(MIN)
    })

    it("continues the profile's last stored session, but not another profile's", () => {
      const last: Session = { id: 'old', profileId: 'p1', startedAt: 0, endedAt: 5 * MIN }
      const mine = recorder(last)
      mine.send({ type: 'load', entry: BOOKMARK, now: 6 * MIN })
      mine.send(play(6 * MIN))
      mine.send({ type: 'pause', now: 7 * MIN })
      expect(mine.writes[0]?.session).toEqual({ ...last, endedAt: 7 * MIN })

      const other = recorder(last)
      other.send({ type: 'load', entry: { ...BOOKMARK, profileId: 'p2' }, now: 6 * MIN })
      other.send(play(6 * MIN))
      other.send({ type: 'pause', now: 7 * MIN })
      expect(other.writes[0]?.session.id).not.toBe('old')
    })
  })

  describe('setup per record (tempo, loop, metronome, temporary)', () => {
    const SETUP = {
      tempoPercent: 85,
      loop: { startBar: 17, endBar: 32 },
      metronomeMode: 'off',
      temporary: false,
    } as const

    it('stores the setup in effect with each record', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send({ type: 'setup', setup: SETUP, now: 0 })
      send(play(0))
      send({ type: 'pause', now: MIN })
      expect(records()[0]).toMatchObject(SETUP)
    })

    it('ends the stretch and starts a new record when the setup changes mid-stretch', () => {
      const { send, records, writes } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send({ type: 'setup', setup: SETUP, now: 0 })
      send(play(0))
      // A temporary tempo change after a minute: the first record closes there.
      const closed = send({
        type: 'setup',
        setup: { ...SETUP, tempoPercent: 70, temporary: true },
        now: MIN,
      })
      expect(closed?.record).toMatchObject({ tempoPercent: 85, temporary: false, playedMs: MIN })
      send({ type: 'pause', now: 3 * MIN })
      expect(records().map((r) => [r.tempoPercent, r.temporary, r.playedMs])).toEqual([
        [85, false, MIN],
        [70, true, 2 * MIN],
      ])
      // Both in one session, attributed to the same bookmark.
      expect(new Set(writes.map((w) => w.session.id)).size).toBe(1)
      expect(records().every((r) => r.bookmarkId === 'b1')).toBe(true)
    })

    it('splits on a loop or metronome change too, and not on an unchanged setup', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send({ type: 'setup', setup: SETUP, now: 0 })
      send(play(0))
      expect(send({ type: 'setup', setup: { ...SETUP }, now: MIN })).toBeNull()
      send({ type: 'setup', setup: { ...SETUP, loop: null }, now: 2 * MIN })
      send({
        type: 'setup',
        setup: { ...SETUP, loop: null, metronomeMode: 'always' },
        now: 3 * MIN,
      })
      send({ type: 'stop', now: 4 * MIN })
      expect(records().map((r) => [r.loop, r.metronomeMode, r.playedMs])).toEqual([
        [{ startBar: 17, endBar: 32 }, 'off', 2 * MIN],
        [null, 'off', MIN],
        [null, 'always', MIN],
      ])
    })

    it('keeps a pass going across a split (a tempo change mid-pass still counts)', () => {
      const { send, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      send({ type: 'setup', setup: SETUP, now: 0 })
      send(play(0))
      send({ type: 'setup', setup: { ...SETUP, tempoPercent: 90, temporary: true }, now: 1000 })
      send({ type: 'wrap', now: 2000 })
      send({ type: 'pause', now: 3000 })
      expect(records().map((r) => r.passes)).toEqual([0, 1])
    })

    it('only remembers a setup change while not playing', () => {
      const { send, writes, records } = recorder()
      send({ type: 'load', entry: BOOKMARK, now: 0 })
      expect(send({ type: 'setup', setup: SETUP, now: 0 })).toBeNull()
      expect(writes).toHaveLength(0)
      send(play(MIN))
      send({ type: 'pause', now: 2 * MIN })
      expect(records()).toHaveLength(1)
      expect(records()[0]).toMatchObject({ tempoPercent: 85 })
    })
  })
})
