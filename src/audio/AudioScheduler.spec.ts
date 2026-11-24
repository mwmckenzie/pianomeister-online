// @vitest-environment node
// Runs in Node: the scheduler only talks to the AudioOutput interface, not Web Audio.
import { describe, expect, it } from 'vitest'

import { EventBus } from '@/core/events/EventBus'
import type { HandNote } from '@/core/hands/HandNote'
import type { HandAudio } from '@/core/practice/HandAudio'
import { FakeClock } from '@/core/testing/FakeClock'
import { BarMap } from '@/core/timing/BarMap'
import { TempoMap } from '@/core/timing/TempoMap'
import { Transport } from '@/core/transport/Transport'
import type { TransportEvents } from '@/core/transport/TransportEvents'

import { AudioScheduler } from './AudioScheduler'
import { type AudioSettings, DEFAULT_AUDIO_SETTINGS } from './AudioSettings'
import type { MetronomeMode } from './MetronomeMode'
import { ManualTicker } from './testing/ManualTicker'
import { RecordingOutput } from './testing/RecordingOutput'

// 480 ppq, 4/4, 120 BPM: a beat is 0.5 s and a bar is 2 s. The clock starts at 100 s.
const PPQ = 480
const BAR = 1920
const T0 = 100

const note = (
  midi: number,
  startTick: number,
  endTick: number,
  hand: 'right' | 'left' = 'right',
  soundEndTick = endTick,
): HandNote => ({
  id: 'n',
  track: 0,
  midi,
  channel: hand === 'right' ? 0 : 1,
  startTick,
  endTick,
  soundEndTick,
  velocity: 100,
  hand,
})

/** Bar 1: right C5 on beat 1, left C3 on beat 3. Bars 2–4: one right-hand note on beat 1. */
const NOTES: HandNote[] = [
  note(72, 0, 480),
  note(48, 960, 1440, 'left'),
  note(74, BAR, BAR + 480),
  note(76, 2 * BAR, 2 * BAR + 480),
  note(77, 3 * BAR, 4 * BAR),
]

function setup(notes: HandNote[] = NOTES) {
  const clock = new FakeClock(T0)
  const bus = new EventBus<TransportEvents>()
  const transport = new Transport({ clock, bus })
  const endTick = notes.reduce((max, n) => Math.max(max, n.endTick), 0)
  transport.setSong({
    notes,
    tempoMap: new TempoMap(PPQ, []),
    barMap: BarMap.fromSong({ ppq: PPQ, durationTicks: endTick, timeSignatureEvents: [] }, null),
    endTick,
  })
  const output = new RecordingOutput(clock)
  const ticker = new ManualTicker()
  const scheduler = new AudioScheduler({ transport, bus, clock, output, ticker })
  scheduler.start()
  output.releaseCount = 0
  output.log.length = 0
  /** Advances the clock in ticker-sized steps, ticking like the browser's 25 ms worker. */
  const run = (seconds: number, step = 0.025) => {
    for (let t = 0; t < seconds - 1e-9; t += step) {
      clock.advance(Math.min(step, seconds - t))
      ticker.tick()
    }
  }
  return { clock, bus, transport, output, ticker, scheduler, run }
}

/** `midi@time` (time relative to T0, 3 decimals) for compact, order-sensitive assertions. */
const plan = (output: RecordingOutput) =>
  output.audible.map((n) => `${n.midi}@${(n.time - T0).toFixed(3)}`)

const last = (output: RecordingOutput) => output.audible[output.audible.length - 1]

const settings = (patch: Partial<AudioSettings>): AudioSettings => ({
  ...DEFAULT_AUDIO_SETTINGS,
  ...patch,
})

describe('AudioScheduler — timing', () => {
  it('schedules notes ahead at exact audio times at 100% tempo', () => {
    const { transport, output, run } = setup()
    transport.play()
    run(2.1)
    expect(plan(output)).toEqual(['72@0.000', '48@1.000', '74@2.000'])
    expect(output.audible.map((n) => n.duration)).toEqual([0.5, 0.5, 0.5])
    expect(output.audible.map((n) => n.hand)).toEqual(['right', 'left', 'right'])
  })

  it('stretches onsets and durations at 50% tempo', () => {
    const { transport, output, run } = setup()
    transport.setTempoPercent(50)
    transport.play()
    run(4.1)
    expect(plan(output)).toEqual(['72@0.000', '48@2.000', '74@4.000'])
    expect(output.audible[0]?.duration).toBe(1)
  })

  it('schedules each note exactly once, whatever the tick size', () => {
    const { transport, output, run } = setup()
    transport.play()
    run(8.5, 0.037)
    expect(plan(output)).toEqual(['72@0.000', '48@1.000', '74@2.000', '76@4.000', '77@6.000'])
  })

  it('uses the pedal-extended sounding length for duration', () => {
    const { transport, output, run } = setup([note(60, 0, 480, 'right', 1920)])
    transport.play()
    run(0.1)
    expect(output.audible[0]?.duration).toBe(2)
  })

  it('sends integer velocities in 1–127', () => {
    const quiet = { ...note(60, 0, 480), velocity: 0 }
    const { transport, output, run } = setup([quiet])
    transport.play()
    run(0.1)
    expect(output.audible[0]?.velocity).toBe(1)
  })
})

describe('AudioScheduler — loops', () => {
  it('plays the loop start on time at every wrap, with no gap or duplicate', () => {
    const { transport, output, run } = setup()
    transport.setLoop({ startBar: 1, endBar: 1 })
    transport.play()
    run(6.05, 0.037)
    expect(plan(output)).toEqual([
      '72@0.000',
      '48@1.000',
      '72@2.000',
      '48@3.000',
      '72@4.000',
      '48@5.000',
      '72@6.000',
    ])
    // The wrap is scheduled ahead, so it never needs to release anything.
    expect(output.releaseCount).toBe(0)
  })

  it('re-applies pre-roll at each wrap and flags those notes', () => {
    const { transport, output, run } = setup()
    transport.setPreRoll({ beats: 4, mode: 'quiet' })
    transport.setLoop({ startBar: 2, endBar: 2 })
    transport.seekToBar(2)
    transport.play() // pre-roll covers bar 1 (song 0–2 s), loop is bar 2 (2–4 s)
    run(8.05)
    expect(
      output.audible.map((n) => `${n.midi}@${(n.time - T0).toFixed(3)}${n.preRoll ? ' pre' : ''}`),
    ).toEqual([
      '72@0.000 pre',
      '48@1.000 pre',
      '74@2.000',
      '72@4.000 pre',
      '48@5.000 pre',
      '74@6.000',
      '72@8.000 pre',
    ])
  })

  it('clips sound at the loop end so the release starts there', () => {
    const { transport, output, run } = setup([note(60, 0, 480, 'right', 4 * BAR)])
    transport.setLoop({ startBar: 1, endBar: 1 })
    transport.play()
    run(0.1)
    expect(output.audible[0]?.duration).toBe(2)
  })
})

describe('AudioScheduler — resets', () => {
  it('releases and drops pending notes on seek, then schedules from the target', () => {
    const { transport, output, run } = setup()
    transport.play()
    run(1.95) // 74 at 2.0 s is now scheduled but not yet started
    expect(plan(output)).toContain('74@2.000')
    transport.seekToBar(3)
    expect(output.log).toEqual(['releaseAll'])
    expect(output.cancelled.map((n) => n.midi)).toEqual([74])
    expect(plan(output)).toEqual(['72@0.000', '48@1.000', '76@1.950'])
  })

  it('releases on pause and resumes scheduling from the paused position', () => {
    const { clock, transport, output, run } = setup()
    transport.play()
    run(0.9)
    transport.pause()
    expect(output.releaseCount).toBe(1)
    clock.advance(10)
    run(1)
    expect(plan(output)).toEqual(['72@0.000'])
    transport.play() // resumes at song 0.9 s; 48 (1.0 s) is 0.1 s later
    expect(last(output)?.midi).toBe(48)
    expect((last(output)?.time ?? NaN) - clock.now()).toBeCloseTo(0.1, 9)
  })

  it('releases on a tempo change and reschedules at the new rate', () => {
    const { clock, transport, output, run } = setup()
    transport.play()
    run(0.95)
    transport.setTempoPercent(50)
    expect(output.releaseCount).toBe(1)
    expect(output.cancelled.map((n) => n.midi)).toEqual([48])
    run(0.2)
    // 48 is 0.05 song-seconds away at 50% speed: 0.1 s after the change.
    expect(last(output)?.midi).toBe(48)
    expect(last(output)?.time ?? NaN).toBeCloseTo(T0 + 1.05, 9)
    expect(clock.now()).toBeCloseTo(T0 + 1.15, 9)
  })

  it('only re-plans pending notes when the loop changes during playback', () => {
    const { transport, output, run } = setup()
    transport.play()
    run(1.95)
    transport.setLoop({ startBar: 1, endBar: 1 })
    expect(output.releaseCount).toBe(0)
    expect(output.log).toHaveLength(1)
    expect(output.log[0]).toMatch(/^cancelPending /)
    run(0.1)
    // The pending bar-2 note became a wrap back to bar 1.
    expect(plan(output)).toEqual(['72@0.000', '48@1.000', '72@2.000'])
  })

  it('lets the last notes ring at the song end instead of releasing them', () => {
    const { transport, output, run } = setup()
    transport.seekToBar(4)
    transport.play()
    output.releaseCount = 0 // the seek itself released (harmlessly, nothing was sounding)
    run(2.5)
    expect(transport.state).toBe('stopped')
    expect(output.releaseCount).toBe(0)
    expect(output.audible.map((n) => [n.midi, n.duration])).toEqual([[77, 2]])
  })

  it('drops notes that are already stale after a late tick', () => {
    const { clock, transport, output, ticker } = setup()
    transport.play()
    clock.advance(1.2) // no ticks for 1.2 s; 48 at 1.0 s is 0.2 s late
    ticker.tick()
    expect(plan(output)).toEqual(['72@0.000'])
  })

  it('stops ticking and silences on dispose', () => {
    const { transport, output, ticker, scheduler } = setup()
    transport.play()
    scheduler.dispose()
    expect(ticker.running).toBe(false)
    expect(output.releaseCount).toBe(1)
  })
})

describe('AudioScheduler — gains', () => {
  it('sends each note to its own hand, whatever its channel', () => {
    const same = [
      { ...note(72, 0, 480), channel: 3 },
      { ...note(48, 0, 480, 'left'), channel: 3 },
    ]
    const { transport, output, run } = setup(same)
    transport.play()
    run(0.1)
    expect(output.notes.map((n) => [n.midi, n.hand])).toEqual([
      [72, 'right'],
      [48, 'left'],
    ])
  })

  const hands = (right: HandAudio, left: HandAudio, rv = 1, lv = 1) => ({
    right: { volume: rv, audio: right },
    left: { volume: lv, audio: left },
  })

  it('applies master and per-hand volume with mute and solo', () => {
    const { output, scheduler } = setup()
    scheduler.setSettings(settings({ master: 0.5, hands: hands('on', 'on', 0.7, 0.4) }))
    expect(output.gains).toMatchObject({ master: 0.5, right: 0.7, left: 0.4 })
    scheduler.setSettings(settings({ hands: hands('on', 'muted') }))
    expect(output.gains).toMatchObject({ right: 1, left: 0 })
    scheduler.setSettings(settings({ hands: hands('on', 'solo', 0.5, 0.9) }))
    expect(output.gains).toMatchObject({ right: 0, left: 0.9 })
  })

  it('sets the pre-roll gain from the transport mode: 0 when muted, the quiet level when quiet', () => {
    const { transport, output, scheduler } = setup()
    expect(output.gains?.preRoll).toBe(0)
    transport.setPreRoll({ beats: 2, mode: 'quiet' })
    expect(output.gains?.preRoll).toBe(0.25)
    scheduler.setSettings(settings({ quietLevel: 0.4 }))
    expect(output.gains?.preRoll).toBe(0.4)
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    expect(output.gains?.preRoll).toBe(0)
  })
})

describe('AudioScheduler — metronome', () => {
  const clicksFor = (mode: MetronomeMode) => {
    const { transport, output, scheduler, run } = setup()
    scheduler.setSettings(settings({ metronome: { mode, volume: 0.5 } }))
    transport.setPreRoll({ beats: 2, mode: 'muted' })
    transport.seekToBar(2)
    transport.play() // pre-roll beats at 0 and 0.5 s (bar 1 beats 3–4), bar 2 from 1 s
    run(2.05)
    return output.clicks.map((c) => `${(c.time - T0).toFixed(2)}${c.accent ? '!' : ''}`)
  }

  it('is silent when off', () => {
    expect(clicksFor('off')).toEqual([])
  })

  it('clicks only during the pre-roll in preRoll mode', () => {
    expect(clicksFor('preRoll')).toEqual(['0.00', '0.50'])
  })

  it('clicks every beat in always mode, accenting downbeats', () => {
    expect(clicksFor('always')).toEqual(['0.00', '0.50', '1.00!', '1.50', '2.00'])
  })

  it('sets the metronome gain from its own volume', () => {
    const { output, scheduler } = setup()
    scheduler.setSettings(settings({ metronome: { mode: 'always', volume: 0.3 } }))
    expect(output.gains?.metronome).toBe(0.3)
  })
})
