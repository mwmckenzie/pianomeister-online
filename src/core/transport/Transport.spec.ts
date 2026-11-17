// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'

import { EventBus } from '../events/EventBus'
import type { HandNote } from '../hands/HandNote'
import type { TempoEvent } from '../song/TempoEvent'
import { FakeClock } from '../testing/FakeClock'
import { BarMap } from '../timing/BarMap'
import { TempoMap } from '../timing/TempoMap'
import { Transport } from './Transport'
import type { TransportEvents } from './TransportEvents'
import type { TransportSong } from './TransportSong'

// 480 ppq, 4/4, 120 BPM by default: a beat is 0.5 s and a bar is 2 s.
const PPQ = 480
const BAR = 1920

const note = (
  midi: number,
  startTick: number,
  endTick: number,
  hand: 'right' | 'left' = 'right',
  soundEndTick = endTick,
): HandNote => ({
  midi,
  channel: hand === 'right' ? 0 : 1,
  startTick,
  endTick,
  soundEndTick,
  velocity: 100,
  hand,
})

/** Four bars: one right-hand note per bar on beat 1, a left-hand note on beat 3 of bar 1. */
const NOTES: HandNote[] = [
  note(72, 0, 480),
  note(48, 960, 1440, 'left'),
  note(74, BAR, BAR + 480),
  note(76, 2 * BAR, 2 * BAR + 480),
  note(77, 3 * BAR, 4 * BAR),
]

function makeSong(notes: HandNote[] = NOTES, tempoEvents: TempoEvent[] = []): TransportSong {
  const endTick = notes.reduce((max, n) => Math.max(max, n.endTick), 0)
  return {
    notes,
    tempoMap: new TempoMap(PPQ, tempoEvents),
    barMap: BarMap.fromSong({ ppq: PPQ, durationTicks: endTick, timeSignatureEvents: [] }, null),
    endTick,
  }
}

type Logged = { type: keyof TransportEvents; detail: string; time: number }

describe('Transport', () => {
  let clock: FakeClock
  let bus: EventBus<TransportEvents>
  let transport: Transport
  let log: Logged[]

  const record = () => {
    const at = () => transport.position
    bus.on('noteOn', (e) =>
      log.push({
        type: 'noteOn',
        detail: `${e.note.midi}${e.isPreRoll ? ' pre' : ''}`,
        time: at(),
      }),
    )
    bus.on('noteOff', (e) => log.push({ type: 'noteOff', detail: `${e.note.midi}`, time: at() }))
    bus.on('allNotesOff', () => log.push({ type: 'allNotesOff', detail: '', time: at() }))
    bus.on('beat', (e) =>
      log.push({
        type: 'beat',
        detail: `${e.bar}:${e.beat}${e.isPreRoll ? ' pre' : ''}`,
        time: at(),
      }),
    )
    bus.on('stateChange', (e) => log.push({ type: 'stateChange', detail: e.state, time: at() }))
    bus.on('loopWrap', (e) =>
      log.push({ type: 'loopWrap', detail: `${e.startBar}-${e.endBar}`, time: at() }),
    )
  }
  const types = (type: keyof TransportEvents) =>
    log.filter((e) => e.type === type).map((e) => e.detail)
  /** Advances in small frame-sized steps, calling update() like a host's animation loop. */
  const run = (seconds: number, step = 1 / 60) => {
    for (let t = 0; t < seconds - 1e-9; t += step) {
      clock.advance(Math.min(step, seconds - t))
      transport.update()
    }
  }

  beforeEach(() => {
    clock = new FakeClock(100)
    bus = new EventBus<TransportEvents>()
    transport = new Transport({ clock, bus })
    transport.setSong(makeSong())
    log = []
    record()
  })

  it('plays notes and beats in order from bar 1', () => {
    transport.play()
    run(1.6)
    expect(transport.state).toBe('playing')
    expect(log.map((e) => `${e.type} ${e.detail}`)).toEqual([
      'stateChange playing',
      'noteOn 72',
      'beat 1:1',
      'noteOff 72',
      'beat 1:2',
      'noteOn 48',
      'beat 1:3',
      'noteOff 48',
      'beat 1:4',
    ])
  })

  it('emits every beat exactly once over a whole song, whatever the frame size', () => {
    transport.play()
    run(10, 0.0137)
    expect(types('beat')).toHaveLength(16)
    expect(types('noteOn')).toEqual(['72', '48', '74', '76', '77'])
    expect(types('noteOff')).toEqual(['72', '48', '74', '76', '77'])
  })

  it('does not jump when the tempo changes mid-play', () => {
    transport.play()
    clock.advance(1)
    expect(transport.position).toBeCloseTo(1, 9)
    transport.setTempoPercent(50)
    expect(transport.position).toBeCloseTo(1, 9)
    clock.advance(1)
    expect(transport.position).toBeCloseTo(1.5, 9)
    transport.setTempoPercent(200)
    clock.advance(1)
    expect(transport.position).toBeCloseTo(3.5, 9)
  })

  it('clamps tempo to 25–200%', () => {
    transport.setTempoPercent(10)
    expect(transport.tempoPercent).toBe(25)
    transport.setTempoPercent(500)
    expect(transport.tempoPercent).toBe(200)
  })

  it('emits allNotesOff on seek, whether playing or paused', () => {
    transport.play()
    run(0.1)
    transport.seekToBar(3)
    expect(types('allNotesOff')).toHaveLength(1)
    expect(transport.position).toBeCloseTo(4, 9)
    transport.pause()
    transport.seekToBar(2)
    expect(types('allNotesOff')).toHaveLength(3)
    expect(transport.position).toBeCloseTo(2, 9)
  })

  it('does not retrigger a note that is already held at the seek target', () => {
    transport.setSong(makeSong([note(60, 0, 2 * BAR), note(62, BAR, BAR + 100)]))
    log = []
    transport.seekToBar(2)
    transport.play()
    run(1)
    expect(types('noteOn')).toEqual(['62'])
  })

  it('wraps at the end of endBar and re-applies pre-roll', () => {
    transport.setLoop({ startBar: 2, endBar: 3 })
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.seekToBar(2)
    transport.play()
    // Pre-roll starts 2 beats (1 s) before bar 2 at 2 s.
    expect(transport.position).toBeCloseTo(1, 9)
    run(1 + 4 - 0.01) // through the pre-roll and bars 2–3, stopping just short of 6 s
    expect(types('loopWrap')).toHaveLength(0)
    log = []
    run(0.02)
    expect(types('loopWrap')).toEqual(['2-3'])
    expect(log.findIndex((e) => e.type === 'allNotesOff')).toBeLessThan(
      log.findIndex((e) => e.type === 'loopWrap'),
    )
    // Back in the pre-roll before bar 2, carrying the overshoot past the loop end.
    expect(transport.position).toBeCloseTo(1.01, 6)
    expect(transport.inPreRoll).toBe(true)
    log = []
    run(1)
    expect(types('beat')).toEqual(['1:4 pre', '2:1'])
    expect(types('noteOn')).toEqual(['74'])
  })

  it('runs a pre-roll before bar 1 at negative song time with no note events', () => {
    transport.setPreRoll({ beats: 4, mode: 'quiet' })
    transport.play()
    expect(transport.position).toBeCloseTo(-2, 9)
    run(1.99)
    expect(transport.position).toBeLessThan(0)
    expect(types('noteOn')).toEqual([])
    expect(types('beat')).toEqual(['0:1 pre', '0:2 pre', '0:3 pre', '0:4 pre'])
    run(0.02)
    expect(types('noteOn')).toEqual(['72'])
    expect(types('beat').slice(-1)).toEqual(['1:1'])
  })

  it('flags notes inside a mid-song pre-roll window', () => {
    transport.setPreRoll({ beats: 4, mode: 'muted' })
    transport.seekToBar(3)
    transport.play()
    run(2.5)
    expect(types('noteOn')).toEqual(['74 pre', '76'])
  })

  it('times the pre-roll with the tempo at the target bar', () => {
    // 60 BPM from bar 2 on: a beat there is 1 s, though bar 1 runs at 120 BPM.
    transport.setSong(makeSong(NOTES, [{ tick: BAR, microsPerQuarter: 1_000_000 }]))
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.seekToBar(2)
    transport.play()
    expect(transport.position).toBeCloseTo(0, 9)
  })

  it('preserves the position across pause and resume without re-applying pre-roll', () => {
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.play()
    run(2.25)
    const paused = transport.position
    transport.pause()
    expect(transport.state).toBe('paused')
    expect(types('allNotesOff')).toHaveLength(1)
    clock.advance(5)
    expect(transport.position).toBe(paused)
    transport.play()
    expect(transport.position).toBeCloseTo(paused, 9)
    expect(transport.inPreRoll).toBe(false)
  })

  it('applies pre-roll after a seek while paused', () => {
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.play()
    run(3)
    transport.pause()
    transport.seekToBar(3)
    transport.play()
    expect(transport.position).toBeCloseTo(3, 9)
    expect(transport.inPreRoll).toBe(true)
  })

  it('exposes the active pre-roll window only while inside it', () => {
    expect(transport.activePreRoll).toBeNull()
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.seekToBar(3)
    transport.play()
    expect(transport.activePreRoll).toMatchObject({ targetTick: 2 * BAR, beats: 2, endSec: 4 })
    run(1.01)
    expect(transport.activePreRoll).toBeNull()
  })

  it('snaps prevBar like a media player and clamps next/prev to the song', () => {
    transport.seekToBar(3)
    transport.prevBar() // exactly at a bar start → previous bar
    expect(transport.position).toBeCloseTo(2, 9)
    transport.play()
    run(0.2) // within the first half beat (0.25 s) of bar 2
    transport.prevBar()
    expect(transport.position).toBeCloseTo(0, 9)
    run(0.5) // past half a beat into bar 1
    transport.nextBar()
    transport.nextBar()
    run(0.3)
    transport.prevBar()
    expect(transport.position).toBeCloseTo(4, 9) // back to the start of bar 3
    transport.seekToBar(99)
    expect(transport.position).toBeCloseTo(6, 9)
    transport.nextBar()
    expect(transport.position).toBeCloseTo(6, 9)
    transport.seekToBar(-5)
    transport.prevBar()
    expect(transport.position).toBeCloseTo(0, 9)
  })

  it('stops and rewinds at the end of the song', () => {
    transport.seekToBar(4)
    transport.play()
    run(2.1)
    expect(transport.state).toBe('stopped')
    expect(transport.position).toBe(0)
    expect(types('noteOff')).toEqual(['77'])
    expect(types('allNotesOff').length).toBeGreaterThan(0)
  })

  it('rewinds stop() to the loop start when a loop is set', () => {
    transport.setLoop({ startBar: 3, endBar: 4 })
    transport.seekToBar(1)
    transport.play()
    run(1)
    transport.stop()
    expect(transport.state).toBe('stopped')
    expect(transport.position).toBeCloseTo(4, 9)
  })

  it('moves a stopped transport to the start of a newly set loop, but not a paused one', () => {
    transport.setLoop({ startBar: 2, endBar: 3 })
    expect(transport.position).toBeCloseTo(2, 9)
    transport.play()
    run(0.1)
    expect(types('noteOn')).toEqual(['74'])

    transport.pause()
    const paused = transport.position
    transport.setLoop({ startBar: 4, endBar: 4 })
    expect(transport.position).toBe(paused)
  })

  it('validates and clamps loops', () => {
    expect(() => transport.setLoop({ startBar: 3, endBar: 2 })).toThrow(RangeError)
    expect(() => transport.setLoop({ startBar: 1.5, endBar: 2 })).toThrow(RangeError)
    transport.setLoop({ startBar: 0, endBar: 40 })
    expect(transport.loop).toEqual({ startBar: 1, endBar: 4 })
    transport.setLoop(null)
    expect(transport.loop).toBeNull()
  })

  it('answers notesStartingIn and exposes the clock ↔ song mapping', () => {
    expect(transport.notesStartingIn(0, 2).map((n) => n.note.midi)).toEqual([72, 48])
    expect(transport.notesStartingIn(0.5, 0.5)).toEqual([])
    const [first] = transport.notesStartingIn(2, 2.01)
    expect(first).toMatchObject({ startSec: 2, endSec: 2.5 })

    transport.setTempoPercent(50)
    transport.play()
    const timeline = transport.getTimeline()
    expect(timeline).toEqual({ state: 'playing', clockAnchor: 100, songAnchor: 0, rate: 0.5 })
    expect(transport.songTimeAt(104)).toBeCloseTo(2, 9)
  })
})

describe('Transport — look-ahead queries for the audio scheduler', () => {
  let clock: FakeClock
  let bus: EventBus<TransportEvents>
  let transport: Transport

  beforeEach(() => {
    clock = new FakeClock(100)
    bus = new EventBus<TransportEvents>()
    transport = new Transport({ clock, bus })
    transport.setSong(makeSong())
  })

  it('has no segments unless playing', () => {
    expect(transport.segmentsBetween(100, 101)).toEqual([])
  })

  it('maps one segment up to the song end when not looping', () => {
    transport.play()
    expect(transport.segmentsBetween(100, 200)).toEqual([
      {
        clockStart: 100,
        clockEnd: 108,
        songStart: 0,
        songEnd: 8,
        rate: 1,
        preRoll: null,
        soundLimitSec: null,
      },
    ])
  })

  it('scales song time by the tempo rate', () => {
    transport.setTempoPercent(50)
    transport.play()
    const [segment] = transport.segmentsBetween(100, 101)
    expect(segment).toMatchObject({ songStart: 0, songEnd: 0.5, rate: 0.5 })
  })

  it('splits at a loop wrap into the next iteration and its pre-roll, as update() then does', () => {
    transport.setLoop({ startBar: 2, endBar: 3 })
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.seekToBar(2)
    transport.play() // clock 100 = song 1.0 (2 beats before bar 2 at 2 s); loop end 6 s = clock 105
    const segments = transport.segmentsBetween(104.9, 105.2)
    expect(segments).toHaveLength(2)
    const [before, after] = segments
    expect(before?.clockStart).toBeCloseTo(104.9, 9)
    expect(before?.clockEnd).toBeCloseTo(105, 9)
    expect(before?.songStart).toBeCloseTo(5.9, 9)
    expect(before?.songEnd).toBeCloseTo(6, 9)
    expect(before?.soundLimitSec).toBeCloseTo(6, 9)
    expect(after?.clockStart).toBeCloseTo(105, 9)
    expect(after?.songStart).toBeCloseTo(1, 9)
    expect(after?.songEnd).toBeCloseTo(1.2, 9)
    expect(after?.preRoll?.endSec).toBeCloseTo(2, 9)

    clock.advance(5.1)
    transport.update()
    expect(transport.position).toBeCloseTo(1.1, 9)
  })

  it('covers several wraps in one window without gaps', () => {
    transport.setLoop({ startBar: 1, endBar: 1 })
    transport.play()
    const segments = transport.segmentsBetween(100, 105)
    expect(segments.map((s) => [s.clockStart, s.clockEnd, s.songStart, s.songEnd])).toEqual([
      [100, 102, 0, 2],
      [102, 104, 0, 2],
      [104, 105, 0, 1],
    ])
  })

  it('answers beatsStartingIn with downbeats and an explicit pre-roll window', () => {
    expect(transport.beatsStartingIn(1.5, 2.6)).toEqual([
      { bar: 1, beat: 4, isDownbeat: false, isPreRoll: false, songSec: 1.5 },
      { bar: 2, beat: 1, isDownbeat: true, isPreRoll: false, songSec: 2 },
      { bar: 2, beat: 2, isDownbeat: false, isPreRoll: false, songSec: 2.5 },
    ])
    transport.setPreRoll({ beats: 2, mode: 'quiet' })
    transport.seekToBar(2)
    transport.play()
    const [segment] = transport.segmentsBetween(100, 101.1)
    const beats = transport.beatsStartingIn(1, 2.1, segment?.preRoll ?? null)
    expect(beats.map((b) => `${b.bar}:${b.beat}${b.isPreRoll ? ' pre' : ''}`)).toEqual([
      '1:3 pre',
      '1:4 pre',
      '2:1',
    ])
  })

  it('carries the pedal-extended sound end on each timed note', () => {
    transport.setSong(makeSong([note(60, 0, 480, 'right', 1920)]))
    expect(transport.notesStartingIn(0, 1)[0]).toMatchObject({
      startSec: 0,
      endSec: 0.5,
      soundEndSec: 2,
    })
  })

  it('announces each timeline change with its reason', () => {
    const reasons: string[] = []
    bus.on('timelineChange', (e) => reasons.push(e.reason))
    transport.play()
    transport.setTempoPercent(80)
    transport.seekToBar(2)
    transport.setLoop({ startBar: 1, endBar: 2 })
    transport.setPreRoll({ beats: 1, mode: 'muted' })
    transport.pause()
    transport.stop()
    transport.setSong(makeSong())
    transport.setLoop(null)
    transport.seekToBar(4)
    transport.play()
    clock.advance(4) // at 80% tempo: song 5.5 s → 8.7 s, past the 8 s song end
    transport.update()
    expect(reasons).toEqual([
      'play',
      'tempo',
      'seek',
      'loop',
      'preRoll',
      'pause',
      'stop',
      'song',
      'loop',
      'seek',
      'play',
      'end',
    ])
  })
})
