import type { EventBus } from '../events/EventBus'
import type { BeatEvent } from './BeatEvent'
import { beatsBetween } from './beatsBetween'
import type { Clock } from './Clock'
import type { LoopRange } from './LoopRange'
import type { PreRollConfig } from './PreRollConfig'
import type { PreRollWindow } from './PreRollWindow'
import { preRollWindowFor } from './preRollWindowFor'
import type { TimedNote } from './TimedNote'
import type { Timeline } from './Timeline'
import type { TimelineChangeReason } from './TimelineChangeReason'
import type { TimelineSegment } from './TimelineSegment'
import type { TransportEvents } from './TransportEvents'
import type { TransportSong } from './TransportSong'
import type { TransportState } from './TransportState'
import { loopSeekBar } from './loopSeekBar'

const MIN_TEMPO_PERCENT = 25
const MAX_TEMPO_PERCENT = 200
// Guards segmentsBetween against pathological tiny loops; real windows span one or two wraps.
const MAX_SEGMENTS = 64

interface PreparedSong {
  readonly source: TransportSong
  /** Sorted by startSec. */
  readonly notes: readonly TimedNote[]
  readonly endSec: number
}

interface PendingEvent {
  readonly time: number
  /** Order within one instant: note-offs, then note-ons, then beats. */
  readonly order: number
  readonly fire: () => void
}

/**
 * Playback state machine. Position is in song seconds at 100% tempo (negative during a
 * pre-roll before the song start). The injected clock is the master timeline; the host calls
 * update() each frame and the transport emits note and beat events on the bus.
 */
export class Transport {
  private prepared: PreparedSong | null = null
  private currentState: TransportState = 'stopped'
  private tempo = 100
  private clockAnchor = 0
  private songAnchor = 0
  /** Position while not playing. */
  private heldPosition = 0
  /** Position up to which events have been emitted while playing. */
  private lastPos = 0
  /** Set by stop/seek: the next play() starts at this tick with a pre-roll. */
  private armedTick: number | null = 0
  private preRollConfig: PreRollConfig = { beats: 0, mode: 'muted' }
  private window: PreRollWindow | null = null
  private loopRange: LoopRange | null = null
  /** Notes that got a noteOn and still owe a noteOff, with their onset's pre-roll flag. */
  private readonly sounding = new Map<TimedNote, boolean>()
  private readonly clock: Clock
  private readonly bus: EventBus<TransportEvents>

  constructor(options: { readonly clock: Clock; readonly bus: EventBus<TransportEvents> }) {
    this.clock = options.clock
    this.bus = options.bus
  }

  get state(): TransportState {
    return this.currentState
  }

  get tempoPercent(): number {
    return this.tempo
  }

  get loop(): LoopRange | null {
    return this.loopRange
  }

  get preRoll(): PreRollConfig {
    return this.preRollConfig
  }

  get song(): TransportSong | null {
    return this.prepared?.source ?? null
  }

  /** Current song position in seconds at 100% tempo. */
  get position(): number {
    return this.currentState === 'playing' ? this.songTimeAt(this.clock.now()) : this.heldPosition
  }

  /** True while the current position is inside a pre-roll count-in. */
  get inPreRoll(): boolean {
    return this.window !== null && this.position < this.window.endSec
  }

  /** The count-in being played now, or null outside one (the HUD shows its target bar). */
  get activePreRoll(): PreRollWindow | null {
    return this.inPreRoll ? this.window : null
  }

  setSong(song: TransportSong): void {
    const { tempoMap } = song
    const notes = song.notes
      .map((note) => ({
        note,
        startSec: tempoMap.tickToSeconds(note.startTick),
        endSec: tempoMap.tickToSeconds(note.endTick),
        soundEndSec: tempoMap.tickToSeconds(note.soundEndTick),
      }))
      .sort((a, b) => a.startSec - b.startSec)
    this.prepared = { source: song, notes, endSec: tempoMap.tickToSeconds(song.endTick) }
    // Bar numbers may mean something else under a new bar map; keep the loop only if it still fits.
    this.loopRange =
      this.loopRange === null ? null : this.clampLoop(this.loopRange, song.barMap.barCount)
    this.stopWith('song')
  }

  /**
   * Swaps in a new song without stopping (a playlist timeline rebuilt mid-song, milestone 9.5):
   * the position continues at `positionSec` in the new song's time, playing or not, with nothing
   * silenced and no pre-roll. Listeners hear 'resync', so the scheduler re-plans what it had
   * already queued from the old mapping.
   */
  replaceSong(song: TransportSong, positionSec: number): void {
    const { tempoMap } = song
    const notes = song.notes
      .map((note) => ({
        note,
        startSec: tempoMap.tickToSeconds(note.startTick),
        endSec: tempoMap.tickToSeconds(note.endTick),
        soundEndSec: tempoMap.tickToSeconds(note.soundEndTick),
      }))
      .sort((a, b) => a.startSec - b.startSec)
    this.prepared = { source: song, notes, endSec: tempoMap.tickToSeconds(song.endTick) }
    this.loopRange = null
    this.window = null
    // Notes still sounding belong to the old song's objects: their note-offs would never match.
    this.sounding.clear()
    if (this.currentState === 'playing') {
      this.anchor(positionSec)
      this.lastPos = positionSec
    } else {
      this.heldPosition = positionSec
    }
    this.armedTick = null
    this.changed('resync')
  }

  /**
   * Moves to a song time (Next and Previous song in a playlist, milestone 9.5): playing, it plays
   * on from there without a pre-roll; paused or stopped, it parks there.
   */
  seekToSeconds(seconds: number): void {
    const song = this.prepared
    if (song === null) return
    const target = Math.min(song.endSec, Math.max(0, seconds))
    this.silence()
    this.window = null
    if (this.currentState === 'playing') {
      this.anchor(target)
      this.lastPos = target
      this.armedTick = null
    } else {
      this.heldPosition = target
      this.armedTick = null
    }
    this.changed('seek')
  }

  play(): void {
    if (this.prepared === null || this.currentState === 'playing') return
    // Safety net (decision 8): playing never starts outside an active loop. From a playhead
    // outside it, play starts at the loop start, pre-roll first, like a committed loop jump.
    const loop = this.loopRange
    if (loop !== null) {
      const { barMap, tempoMap } = this.prepared.source
      const tick = this.armedTick ?? tempoMap.secondsToTick(this.heldPosition)
      const bar = barMap.tickToPosition(tick).bar
      if (loopSeekBar(bar, loop) !== bar) this.armedTick = barMap.barStartTick(loop.startBar)
    }
    if (this.armedTick !== null) {
      this.startFrom(this.armedTick)
    } else {
      this.anchor(this.heldPosition)
      this.lastPos = this.heldPosition
    }
    this.setState('playing')
    this.changed('play')
  }

  pause(): void {
    if (this.currentState !== 'playing') return
    this.update()
    // update() may have reached the song end and stopped.
    if (this.currentState !== 'playing') return
    this.heldPosition = this.lastPos
    this.silence()
    this.setState('paused')
    this.changed('pause')
  }

  /** Rewinds to the loop start if a loop is set, otherwise to the song start. */
  stop(): void {
    this.stopWith('stop')
  }

  setTempoPercent(percent: number): void {
    if (!Number.isFinite(percent)) throw new RangeError(`Tempo must be finite, got ${percent}`)
    const position = this.position
    this.tempo = Math.min(MAX_TEMPO_PERCENT, Math.max(MIN_TEMPO_PERCENT, percent))
    // Re-anchor so the new rate applies from the current position instead of from the old anchor.
    if (this.currentState === 'playing') this.anchor(position)
    this.changed('tempo')
  }

  /**
   * Every seek ends here (timeline click, drag release and keys, ←/→, Home): while a loop is on,
   * a bar outside it lands on the loop's first bar.
   */
  seekToBar(bar: number): void {
    const song = this.prepared
    if (song === null) return
    const { barMap } = song.source
    const clamped = Math.min(barMap.barCount, Math.max(barMap.firstBar, Math.round(bar)))
    // While a loop is on, a seek outside it lands on the loop start (decision 8).
    const target = loopSeekBar(clamped, this.loopRange)
    const tick = barMap.barStartTick(target)
    this.silence()
    if (this.currentState === 'playing') this.startFrom(tick)
    else this.hold(tick)
    this.changed('seek')
  }

  nextBar(): void {
    this.seekToBar(this.currentBar() + 1)
  }

  /** Like a media player's "previous track": early in a bar goes to the previous bar. */
  prevBar(): void {
    const song = this.prepared
    if (song === null) return
    const { barMap, tempoMap } = song.source
    const tick = tempoMap.secondsToTick(this.position)
    const bar = Math.max(barMap.firstBar, barMap.tickToPosition(tick).bar)
    const intoBar = tick - barMap.barStartTick(bar)
    this.seekToBar(intoBar < barMap.ticksPerBeat(bar) / 2 ? bar - 1 : bar)
  }

  setLoop(range: LoopRange | null): void {
    if (range === null) {
      this.loopRange = null
      this.changed('loop')
      return
    }
    if (!Number.isInteger(range.startBar) || !Number.isInteger(range.endBar)) {
      throw new RangeError('Loop bars must be integers')
    }
    if (range.startBar > range.endBar) {
      throw new RangeError(`Loop start bar ${range.startBar} is after end bar ${range.endBar}`)
    }
    const song = this.prepared
    this.loopRange = song === null ? range : this.clampLoop(range, song.source.barMap.barCount)
    // Stopped means "parked at the loop start" (see stop()), so a new loop moves the park point.
    if (song !== null && this.loopRange !== null && this.currentState === 'stopped') {
      this.hold(song.source.barMap.barStartTick(this.loopRange.startBar))
    }
    this.changed('loop')
  }

  /**
   * Moves the playhead to the loop's first bar (brief decision 8): while playing it plays on
   * from there, pre-roll first; otherwise it parks there. Every committed loop change ends with
   * this, so the next pass starts at the new range. Without a loop it does nothing.
   */
  seekToLoopStart(): void {
    if (this.loopRange !== null) this.seekToBar(this.loopRange.startBar)
  }

  setPreRoll(config: PreRollConfig): void {
    const beats = Number.isFinite(config.beats) ? Math.max(0, Math.floor(config.beats)) : 0
    this.preRollConfig = { ...config, beats }
    this.changed('preRoll')
  }

  getTimeline(): Timeline {
    return {
      state: this.currentState,
      clockAnchor: this.clockAnchor,
      songAnchor: this.songAnchor,
      rate: this.tempo / 100,
    }
  }

  /** Song position at a clock time, valid while playing (and until the next control call). */
  songTimeAt(clockTime: number): number {
    return this.songAnchor + (clockTime - this.clockAnchor) * (this.tempo / 100)
  }

  /** Notes with startSec in [fromSec, toSec), in start order. */
  notesStartingIn(fromSec: number, toSec: number): readonly TimedNote[] {
    const notes = this.prepared?.notes ?? []
    const lo = firstIndexAtOrAfter(notes, fromSec)
    const hi = firstIndexAtOrAfter(notes, toSec)
    return notes.slice(lo, hi)
  }

  /** Beats with songSec in [fromSec, toSec); `window` is the count-in to use (default: the current one). */
  beatsStartingIn(
    fromSec: number,
    toSec: number,
    window: PreRollWindow | null = this.window,
  ): BeatEvent[] {
    const song = this.prepared
    if (song === null) return []
    return beatsBetween(song.source.barMap, song.source.tempoMap, window, fromSec, toSec)
  }

  /**
   * The clock → song mapping for [clockFrom, clockTo) while playing, split at each loop wrap
   * (where the next segment restarts at the loop start minus its pre-roll) and ending at the
   * song end when not looping. Pure: predicts what update() will do, without doing it.
   */
  segmentsBetween(clockFrom: number, clockTo: number): TimelineSegment[] {
    const song = this.prepared
    if (song === null || this.currentState !== 'playing' || clockTo <= clockFrom) return []
    const { barMap, tempoMap } = song.source
    const rate = this.tempo / 100
    const loop = this.loopRange
    const loopEnd = loop === null ? null : tempoMap.tickToSeconds(barMap.barEndTick(loop.endBar))
    const limit = loopEnd ?? song.endSec

    const out: TimelineSegment[] = []
    let clockAnchor = this.clockAnchor
    let songAnchor = this.songAnchor
    let window = this.window
    let clock = clockFrom
    for (let i = 0; i < MAX_SEGMENTS && clock < clockTo; i++) {
      const clockAtLimit = clockAnchor + (limit - songAnchor) / rate
      const segEnd = Math.min(clockTo, clockAtLimit)
      if (clock < segEnd) {
        out.push({
          clockStart: clock,
          clockEnd: segEnd,
          songStart: songAnchor + (clock - clockAnchor) * rate,
          songEnd: songAnchor + (segEnd - clockAnchor) * rate,
          rate,
          preRoll: window,
          soundLimitSec: loopEnd,
        })
      }
      if (loop === null || clockTo <= clockAtLimit) break
      // The wrap happens at clockAtLimit, exactly where update() re-anchors.
      const loopStartTick = barMap.barStartTick(loop.startBar)
      window = this.windowFor(loopStartTick)
      songAnchor = window?.startSec ?? tempoMap.tickToSeconds(loopStartTick)
      clockAnchor = clockAtLimit
      clock = Math.max(clock, clockAtLimit)
    }
    return out
  }

  /** Advances to the clock's current time and emits everything crossed since the last call. */
  update(): void {
    const song = this.prepared
    if (song === null || this.currentState !== 'playing') return
    const now = this.clock.now()
    const newPos = this.songTimeAt(now)

    if (this.loopRange !== null) {
      const { barMap, tempoMap } = song.source
      const loopEnd = tempoMap.tickToSeconds(barMap.barEndTick(this.loopRange.endBar))
      if (newPos >= loopEnd) {
        this.process(this.lastPos, loopEnd, true)
        this.silence()
        this.bus.emit('loopWrap', { ...this.loopRange })
        this.startFrom(barMap.barStartTick(this.loopRange.startBar))
        // Carry the overshoot into the new iteration so the loop doesn't drift, unless the
        // frame gap was longer than a whole iteration (e.g. a background tab).
        const overshoot = newPos - loopEnd
        if (this.songAnchor + overshoot < loopEnd) {
          this.clockAnchor = now - overshoot / (this.tempo / 100)
          this.process(this.lastPos, this.songTimeAt(now))
        } else {
          // A whole iteration was skipped, so the mapping no longer matches the prediction.
          this.changed('resync')
        }
        return
      }
    } else if (newPos >= song.endSec) {
      this.process(this.lastPos, song.endSec, true)
      this.stopWith('end')
      return
    }

    this.process(this.lastPos, newPos)
  }

  private currentBar(): number {
    const song = this.prepared
    if (song === null) return 1
    const { barMap, tempoMap } = song.source
    return barMap.tickToPosition(tempoMap.secondsToTick(this.position)).bar
  }

  /** Starts playing toward `targetTick`, beginning with the configured pre-roll. */
  private startFrom(targetTick: number): void {
    const song = this.prepared
    if (song === null) return
    this.window = this.windowFor(targetTick)
    const start = this.window?.startSec ?? song.source.tempoMap.tickToSeconds(targetTick)
    this.anchor(start)
    this.lastPos = start
    this.armedTick = null
  }

  /** The count-in before `targetTick` under the current pre-roll config, or null for none. */
  private windowFor(targetTick: number): PreRollWindow | null {
    const song = this.prepared
    if (song === null) return null
    const { barMap, tempoMap } = song.source
    return preRollWindowFor(barMap, tempoMap, targetTick, this.preRollConfig.beats)
  }

  private stopWith(reason: TimelineChangeReason): void {
    const song = this.prepared
    if (song === null) return
    const { barMap } = song.source
    const bar = this.loopRange?.startBar ?? barMap.firstBar
    this.hold(barMap.barStartTick(bar))
    this.silence()
    this.setState('stopped')
    this.changed(reason)
  }

  private changed(reason: TimelineChangeReason): void {
    this.bus.emit('timelineChange', { reason })
  }

  /** Parks the position at a bar start; the next play() applies pre-roll from there. */
  private hold(tick: number): void {
    const song = this.prepared
    if (song === null) return
    this.armedTick = tick
    this.heldPosition = song.source.tempoMap.tickToSeconds(tick)
    this.window = null
  }

  private anchor(songPosition: number): void {
    this.clockAnchor = this.clock.now()
    this.songAnchor = songPosition
  }

  private silence(): void {
    this.sounding.clear()
    this.bus.emit('allNotesOff', undefined)
  }

  private setState(state: TransportState): void {
    const previous = this.currentState
    if (previous === state) return
    this.currentState = state
    this.bus.emit('stateChange', { state, previous })
  }

  private clampLoop(range: LoopRange, barCount: number): LoopRange | null {
    const first = this.prepared?.source.barMap.firstBar ?? 0
    if (range.startBar > barCount) return null
    return { startBar: Math.max(first, range.startBar), endBar: Math.min(barCount, range.endBar) }
  }

  /**
   * Emits every note and beat event in [from, to), in time order. At a loop or song end,
   * `closing` also releases notes ending exactly at `to` so each gets its own noteOff.
   */
  private process(from: number, to: number, closing = false): void {
    const song = this.prepared
    if (song === null || to < from || (to === from && !closing)) return
    const events: PendingEvent[] = []
    const window = this.window
    const endsBy = (timed: TimedNote): boolean =>
      timed.endSec < to || (closing && timed.endSec <= to)

    const pushOff = (timed: TimedNote, isPreRoll: boolean): void => {
      events.push({
        time: timed.endSec,
        order: 0,
        fire: () => {
          this.sounding.delete(timed)
          this.bus.emit('noteOff', { note: timed.note, hand: timed.note.hand, isPreRoll })
        },
      })
    }

    for (const [timed, isPreRoll] of this.sounding) {
      if (endsBy(timed)) pushOff(timed, isPreRoll)
    }

    for (const timed of this.notesStartingIn(from, to)) {
      const isPreRoll = window !== null && timed.startSec < window.endSec
      events.push({
        time: timed.startSec,
        order: 1,
        fire: () => {
          this.sounding.set(timed, isPreRoll)
          this.bus.emit('noteOn', { note: timed.note, hand: timed.note.hand, isPreRoll })
        },
      })
      if (endsBy(timed)) pushOff(timed, isPreRoll)
    }

    this.collectBeats(from, to, events)

    events.sort((a, b) => a.time - b.time || a.order - b.order)
    for (const e of events) e.fire()
    this.lastPos = to
  }

  private collectBeats(from: number, to: number, events: PendingEvent[]): void {
    for (const beat of this.beatsStartingIn(from, to)) {
      events.push({ time: beat.songSec, order: 2, fire: () => this.bus.emit('beat', beat) })
    }
  }
}

function firstIndexAtOrAfter(notes: readonly TimedNote[], seconds: number): number {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[mid] as TimedNote).startSec < seconds) lo = mid + 1
    else hi = mid
  }
  return lo
}
