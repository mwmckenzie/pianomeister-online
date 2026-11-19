// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { PracticeConfig } from '../practice/PracticeConfig'
import { PlayRecorder } from './PlayRecorder'
import type { RecorderEntry, RecorderEvent } from './RecorderEvent'
import type { RecorderWrite } from './RecorderWrite'
import type { Session } from './Session'

const SONG: RecorderEntry = { profileId: 'p1', songId: 's1' }
const MIN = 60_000

/** Bookmark b1's setup: bars 17–32 at 85%. */
const B1: PracticeConfig = {
  loop: { startBar: 17, endBar: 32 },
  tempoPercent: 85,
  handAudio: { right: 'on', left: 'muted' },
  preRollBeats: 2,
  preRollMode: 'muted',
  metronomeMode: 'off',
}

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
  /** Loads the song with a setup and what it matches (b1 by default). */
  const load = (now: number, entryId: string | null = 'b1', setup: PracticeConfig = B1) => {
    send({ type: 'load', entry: SONG, now })
    send({ type: 'setup', setup, entryId, now })
  }
  const ev = (type: 'play' | 'pause' | 'stop' | 'end' | 'wrap' | 'jump' | 'tick', now: number) =>
    send({ type, now })
  return { r, send, writes, records, load, ev }
}

describe('PlayRecorder', () => {
  it('records nothing before a song is loaded', () => {
    const { ev, writes } = recorder()
    ev('play', 0)
    ev('pause', 5000)
    expect(writes).toEqual([])
  })

  it('writes one record per stretch, with wall-clock time, the full setup and what it matched', () => {
    const { load, ev, records } = recorder()
    load(0)
    ev('play', 1000)
    ev('pause', 61_000)
    expect(records()).toEqual([
      {
        id: 'id2',
        profileId: 'p1',
        sessionId: 'id1',
        songId: 's1',
        bookmarkId: 'b1',
        startedAt: 1000,
        playedMs: 60_000,
        plays: 1,
        ...B1,
      },
    ])
  })

  describe('a play is a start (decision 70)', () => {
    it('counts the first Play after a load', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('pause', MIN)
      expect(records()[0]?.plays).toBe(1)
    })

    it('does not count resuming after a pause, even after a seek while paused', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('pause', MIN)
      // (A timeline click while paused sends nothing to the recorder.)
      ev('play', 2 * MIN)
      ev('pause', 3 * MIN)
      expect(records().map((r) => r.plays)).toEqual([1, 0])
    })

    it('counts the next Play after Stop and after the song ends (a seek in between too)', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('stop', MIN)
      ev('play', 2 * MIN)
      ev('end', 3 * MIN)
      // Stop, then a timeline click, then Play: still a start.
      ev('play', 4 * MIN)
      ev('pause', 5 * MIN)
      expect(records().map((r) => r.plays)).toEqual([1, 1, 1])
    })

    it('counts every loop wrap: a start and three wraps are four plays', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('wrap', 20_000)
      ev('wrap', 40_000)
      ev('wrap', 60_000)
      ev('pause', 70_000)
      expect(records()).toHaveLength(1)
      expect(records()[0]).toMatchObject({ plays: 4, playedMs: 70_000 })
    })

    it('writes the record as each play counts, so stats update at once', () => {
      const { load, ev, writes } = recorder()
      load(0)
      ev('play', 0)
      expect(writes[writes.length - 1]?.record.plays).toBe(1)
      ev('wrap', 20_000)
      expect(writes[writes.length - 1]?.record).toMatchObject({ plays: 2, playedMs: 20_000 })
    })

    it('counts a loop jump while playing at once, in the record of the new loop', () => {
      const { load, ev, send, records } = recorder()
      load(0)
      ev('play', 0)
      // The loop moves (a new setup, matching nothing), then the playhead jumps to its start.
      send({
        type: 'setup',
        setup: { ...B1, loop: { startBar: 1, endBar: 4 } },
        entryId: null,
        now: MIN,
      })
      ev('jump', MIN)
      ev('pause', 2 * MIN)
      expect(records().map((r) => [r.bookmarkId, r.plays])).toEqual([
        ['b1', 1],
        [null, 1],
      ])
    })

    it('arms a play with a loop jump while paused or stopped: the next Play counts', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('pause', MIN)
      ev('jump', 90_000)
      ev('play', 2 * MIN)
      ev('pause', 3 * MIN)
      // A jump while stopped arms too (the stop already did; one start, not two).
      ev('stop', 4 * MIN)
      ev('jump', 4 * MIN)
      ev('play', 5 * MIN)
      ev('pause', 6 * MIN)
      expect(records().map((r) => r.plays)).toEqual([1, 1, 1])
    })

    it('ends the stretch on load; the next Play after it is a start', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      load(MIN, 'full:s1', { ...B1, loop: null, tempoPercent: 100 })
      ev('play', MIN)
      ev('pause', 2 * MIN)
      expect(records().map((r) => [r.bookmarkId, r.plays, r.playedMs])).toEqual([
        ['b1', 1, MIN],
        ['full:s1', 1, MIN],
      ])
    })

    it('a hidden tab ends the stretch; showing it while playing resumes without a new play', () => {
      const { load, ev, send, records } = recorder()
      load(0)
      ev('play', 0)
      send({ type: 'hidden', now: MIN })
      send({ type: 'visible', playing: true, now: 2 * MIN })
      ev('pause', 3 * MIN)
      expect(records().map((r) => [r.plays, r.playedMs])).toEqual([
        [1, MIN],
        [0, MIN],
      ])
    })
  })

  describe('attribution (decision 70)', () => {
    it('gives plays and time to what the setup matches, switching mid-play', () => {
      const { load, ev, send, records } = recorder()
      load(0)
      ev('play', 0)
      // Tempo changed: matches nothing (other setups) from here.
      send({ type: 'setup', setup: { ...B1, tempoPercent: 90 }, entryId: null, now: MIN })
      ev('wrap', 2 * MIN)
      // Changed back: b1 again.
      send({ type: 'setup', setup: B1, entryId: 'b1', now: 3 * MIN })
      ev('wrap', 4 * MIN)
      ev('pause', 5 * MIN)
      expect(records().map((r) => [r.bookmarkId, r.tempoPercent, r.plays, r.playedMs])).toEqual([
        ['b1', 85, 1, MIN],
        [null, 90, 1, 2 * MIN],
        ['b1', 85, 1, 2 * MIN],
      ])
    })

    it('adopts a bookmark the setup comes to match (another one than loaded)', () => {
      const { load, ev, send, records } = recorder()
      load(0)
      ev('play', 0)
      send({ type: 'setup', setup: { ...B1, tempoPercent: 70 }, entryId: 'b2', now: MIN })
      ev('pause', 2 * MIN)
      expect(records().map((r) => r.bookmarkId)).toEqual(['b1', 'b2'])
    })

    it('splits when only what it matches changes (a bookmark edited to match)', () => {
      const { load, ev, send, records } = recorder()
      load(0, null)
      ev('play', 0)
      send({ type: 'setup', setup: B1, entryId: 'b9', now: MIN })
      ev('pause', 2 * MIN)
      expect(records().map((r) => [r.bookmarkId, r.playedMs])).toEqual([
        [null, MIN],
        ['b9', MIN],
      ])
    })

    it('splits on any setup field (hands, pre-roll, metronome), not on an unchanged one', () => {
      const { load, ev, send, records } = recorder()
      load(0, null)
      ev('play', 0)
      expect(send({ type: 'setup', setup: { ...B1 }, entryId: null, now: MIN })).toBeNull()
      send({
        type: 'setup',
        setup: { ...B1, handAudio: { right: 'solo', left: 'on' } },
        entryId: null,
        now: 2 * MIN,
      })
      send({ type: 'setup', setup: { ...B1, preRollMode: 'quiet' }, entryId: null, now: 3 * MIN })
      send({
        type: 'setup',
        setup: { ...B1, preRollMode: 'quiet', metronomeMode: 'always' },
        entryId: null,
        now: 4 * MIN,
      })
      ev('stop', 5 * MIN)
      expect(records().map((r) => r.playedMs)).toEqual([2 * MIN, MIN, MIN, MIN])
    })

    it('only remembers a setup change while not playing', () => {
      const { load, send, ev, writes, records } = recorder()
      load(0)
      expect(
        send({ type: 'setup', setup: { ...B1, tempoPercent: 60 }, entryId: null, now: 0 }),
      ).toBeNull()
      expect(writes).toHaveLength(0)
      ev('play', MIN)
      ev('pause', 2 * MIN)
      expect(records()).toHaveLength(1)
      expect(records()[0]).toMatchObject({ tempoPercent: 60, bookmarkId: null, plays: 1 })
    })
  })

  it('rewrites a playing stretch on every tick', () => {
    const { load, ev, writes } = recorder()
    load(0)
    ev('play', 0)
    ev('tick', 30_000)
    ev('tick', 60_000)
    expect(writes.map((w) => [w.record.id, w.record.playedMs])).toEqual([
      ['id2', 0],
      ['id2', 30_000],
      ['id2', 60_000],
    ])
    ev('pause', 70_000)
    expect(ev('tick', 90_000)).toBeNull()
  })

  describe('sessions', () => {
    it('joins stretches less than 10 minutes apart into one session', () => {
      const { load, ev, records } = recorder()
      load(0)
      ev('play', 0)
      ev('pause', MIN)
      ev('play', MIN + 10 * MIN)
      ev('pause', 12 * MIN)
      const [first, second] = records()
      expect(second?.sessionId).toBe(first?.sessionId)
    })

    it('starts a new session after more than 10 minutes without playback', () => {
      const { load, ev, writes } = recorder()
      load(0)
      ev('play', 0)
      ev('pause', MIN)
      ev('play', MIN + 10 * MIN + 1)
      ev('pause', 13 * MIN)
      const last = writes[writes.length - 1]
      expect(last?.session.id).not.toBe(writes[0]?.session.id)
      expect(last?.session).toMatchObject({ startedAt: 11 * MIN + 1, endedAt: 13 * MIN })
    })

    it('takes the last session when it arrives late, without re-arming a start', () => {
      const last: Session = { id: 'old', profileId: 'p1', startedAt: 0, endedAt: 5 * MIN }
      const { r, load, ev, records, writes } = recorder()
      load(6 * MIN)
      r.continueSession(last)
      ev('play', 6 * MIN)
      ev('pause', 7 * MIN)
      // Arriving after a session started, it's ignored; a resume still isn't a play.
      r.continueSession({ ...last, id: 'other' })
      ev('play', 8 * MIN)
      ev('pause', 9 * MIN)
      expect(records().map((x) => x.plays)).toEqual([1, 0])
      expect(writes.every((w) => w.session.id === 'old')).toBe(true)
    })

    it("continues the profile's last stored session, but not another profile's", () => {
      const last: Session = { id: 'old', profileId: 'p1', startedAt: 0, endedAt: 5 * MIN }
      const mine = recorder(last)
      mine.load(6 * MIN)
      mine.ev('play', 6 * MIN)
      mine.ev('pause', 7 * MIN)
      expect(mine.writes[mine.writes.length - 1]?.session).toEqual({ ...last, endedAt: 7 * MIN })

      const other = recorder(last)
      other.send({ type: 'load', entry: { ...SONG, profileId: 'p2' }, now: 6 * MIN })
      other.ev('play', 6 * MIN)
      other.ev('pause', 7 * MIN)
      expect(other.writes[0]?.session.id).not.toBe('old')
    })
  })
})
