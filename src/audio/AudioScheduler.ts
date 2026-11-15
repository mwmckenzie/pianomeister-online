import type { EventBus } from '@/core/events/EventBus'
import { handGains } from '@/core/practice/handGains'
import type { Clock } from '@/core/transport/Clock'
import type { TimelineChangeReason } from '@/core/transport/TimelineChangeReason'
import type { TimelineSegment } from '@/core/transport/TimelineSegment'
import type { Transport } from '@/core/transport/Transport'
import type { TransportEvents } from '@/core/transport/TransportEvents'

import type { AudioOutput } from './AudioOutput'
import { type AudioSettings, DEFAULT_AUDIO_SETTINGS } from './AudioSettings'
import type { Ticker } from './Ticker'

const DEFAULT_LOOKAHEAD_SEC = 0.1
/** After a late tick, notes older than this are dropped instead of all playing at once. */
const STALE_SEC = 0.05
/** Keeps a release envelope from being scheduled before its own onset. */
const MIN_DURATION_SEC = 0.01

/** Position jumps or rate changes: what is sounding is wrong now and must be released. */
const HARD_RESETS: ReadonlySet<TimelineChangeReason> = new Set([
  'seek',
  'pause',
  'stop',
  'tempo',
  'song',
])
/** The future changed but the present didn't: only re-plan what hasn't started. */
const SOFT_RESETS: ReadonlySet<TimelineChangeReason> = new Set(['loop', 'preRoll', 'resync'])

/**
 * Look-ahead scheduler (the "two clocks" pattern): a ticker wakes it every ~25 ms, it advances
 * the transport, then hands the output every note and click due in the next ~100 ms at exact
 * audio-clock times. It sees across loop wraps through Transport.segmentsBetween, so the loop
 * start plays on time with no gap and no double trigger.
 */
export class AudioScheduler {
  private settings: AudioSettings = DEFAULT_AUDIO_SETTINGS
  /** Audio time up to which everything has been handed to the output; null when idle. */
  private scheduledUntil: number | null = null
  private unsubscribe: (() => void) | null = null
  private readonly transport: Transport
  private readonly bus: EventBus<TransportEvents>
  private readonly clock: Clock
  private readonly output: AudioOutput
  private readonly ticker: Ticker
  private readonly lookaheadSec: number

  constructor(options: {
    readonly transport: Transport
    readonly bus: EventBus<TransportEvents>
    readonly clock: Clock
    readonly output: AudioOutput
    readonly ticker: Ticker
    readonly lookaheadSec?: number
  }) {
    this.transport = options.transport
    this.bus = options.bus
    this.clock = options.clock
    this.output = options.output
    this.ticker = options.ticker
    this.lookaheadSec = options.lookaheadSec ?? DEFAULT_LOOKAHEAD_SEC
  }

  start(): void {
    if (this.unsubscribe !== null) return
    this.unsubscribe = this.bus.on('timelineChange', (e) => this.onTimelineChange(e.reason))
    this.applyGains()
    this.ticker.start(() => this.tick())
  }

  dispose(): void {
    this.ticker.stop()
    this.unsubscribe?.()
    this.unsubscribe = null
    this.output.releaseAll()
    this.scheduledUntil = null
  }

  setSettings(settings: AudioSettings): void {
    const metronomeChanged = settings.metronome.mode !== this.settings.metronome.mode
    this.settings = settings
    this.applyGains()
    // Clicks already queued were planned for the old mode.
    if (metronomeChanged) this.replanPending()
  }

  /** One scheduler step: advance the transport (emitting note events), then schedule ahead. */
  tick(): void {
    this.transport.update()
    this.schedule()
  }

  private onTimelineChange(reason: TimelineChangeReason): void {
    if (reason === 'preRoll') this.applyGains()
    if (HARD_RESETS.has(reason)) {
      this.output.releaseAll()
      this.restartScheduling()
    } else if (SOFT_RESETS.has(reason)) {
      this.replanPending()
    } else if (reason === 'play') {
      this.restartScheduling()
    } else {
      // 'end': let tails and pedal ring out; nothing more to schedule.
      this.scheduledUntil = null
    }
  }

  private replanPending(): void {
    if (this.scheduledUntil === null) return
    this.output.cancelPending(this.clock.now())
    this.restartScheduling()
  }

  private restartScheduling(): void {
    this.scheduledUntil = this.transport.state === 'playing' ? this.clock.now() : null
    // Schedule right away rather than on the next tick, so a seek or play starts promptly.
    this.schedule()
  }

  private applyGains(): void {
    const { right, left } = handGains(this.settings.hands)
    const quiet = this.transport.preRoll.mode === 'quiet'
    this.output.setGains({
      master: clamp01(this.settings.master),
      right,
      left,
      preRoll: quiet ? clamp01(this.settings.quietLevel) : 0,
      metronome: clamp01(this.settings.metronome.volume),
    })
  }

  private schedule(): void {
    if (this.transport.state !== 'playing') {
      this.scheduledUntil = null
      return
    }
    const now = this.clock.now()
    const from = Math.max(this.scheduledUntil ?? now, now - STALE_SEC)
    const to = now + this.lookaheadSec
    if (to <= from) return
    for (const segment of this.transport.segmentsBetween(from, to)) {
      this.scheduleNotes(segment)
      this.scheduleClicks(segment)
    }
    this.scheduledUntil = to
  }

  private scheduleNotes(segment: TimelineSegment): void {
    const toAudio = (songSec: number): number =>
      segment.clockStart + (songSec - segment.songStart) / segment.rate
    for (const timed of this.transport.notesStartingIn(segment.songStart, segment.songEnd)) {
      const limit = segment.soundLimitSec
      // Inside a loop, sound stops at the loop end so its natural release starts there.
      const soundEnd = limit === null ? timed.soundEndSec : Math.min(timed.soundEndSec, limit)
      this.output.playNote({
        midi: timed.note.midi,
        velocity: Math.min(127, Math.max(1, Math.round(timed.note.velocity))),
        time: toAudio(timed.startSec),
        duration: Math.max(MIN_DURATION_SEC, (soundEnd - timed.startSec) / segment.rate),
        hand: timed.note.hand,
        preRoll: segment.preRoll !== null && timed.startSec < segment.preRoll.endSec,
      })
    }
  }

  private scheduleClicks(segment: TimelineSegment): void {
    const { mode } = this.settings.metronome
    if (mode === 'off') return
    const beats = this.transport.beatsStartingIn(
      segment.songStart,
      segment.songEnd,
      segment.preRoll,
    )
    for (const beat of beats) {
      if (mode === 'preRoll' && !beat.isPreRoll) continue
      const time = segment.clockStart + (beat.songSec - segment.songStart) / segment.rate
      this.output.playClick(time, beat.isDownbeat)
    }
  }
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
