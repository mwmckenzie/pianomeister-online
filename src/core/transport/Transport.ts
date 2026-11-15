import type { EventBus } from '../events/EventBus'
import type { Clock } from './Clock'
import type { LoopRange } from './LoopRange'
import type { PreRollConfig } from './PreRollConfig'
import type { TimedNote } from './TimedNote'
import type { Timeline } from './Timeline'
import type { TransportEvents } from './TransportEvents'
import type { TransportSong } from './TransportSong'
import type { TransportState } from './TransportState'

const MIN_TEMPO_PERCENT = 25
const MAX_TEMPO_PERCENT = 200

interface PreparedSong {
  readonly source: TransportSong
  /** Sorted by startSec. */
  readonly notes: readonly TimedNote[]
  readonly endSec: number
}

/** The count-in before a target bar. Its beats use the tempo and meter at the target. */
interface PreRollWindow {
  readonly startSec: number
  readonly endSec: number
  readonly targetTick: number
  readonly beats: number
  readonly beatSec: number
  readonly ticksPerBeat: number
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
  private preRollConfig: PreRollConfig = { beats: 0, mode: 'muted', metronome: false }
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

  setSong(song: TransportSong): void {
    const { tempoMap } = song
    const notes = song.notes
      .map((note) => ({
        note,
        startSec: tempoMap.tickToSeconds(note.startTick),
        endSec: tempoMap.tickToSeconds(note.endTick),
      }))
      .sort((a, b) => a.startSec - b.startSec)
    this.prepared = { source: song, notes, endSec: tempoMap.tickToSeconds(song.endTick) }
    // Bar numbers may mean something else under a new bar map; keep the loop only if it still fits.
    this.loopRange =
      this.loopRange === null ? null : this.clampLoop(this.loopRange, song.barMap.barCount)
    this.stop()
  }

  play(): void {
    if (this.prepared === null || this.currentState === 'playing') return
    if (this.armedTick !== null) {
      this.startFrom(this.armedTick)
    } else {
      this.anchor(this.heldPosition)
      this.lastPos = this.heldPosition
    }
    this.setState('playing')
  }

  pause(): void {
    if (this.currentState !== 'playing') return
    this.update()
    // update() may have reached the song end and stopped.
    if (this.currentState !== 'playing') return
    this.heldPosition = this.lastPos
    this.silence()
    this.setState('paused')
  }

  /** Rewinds to the loop start if a loop is set, otherwise to the song start. */
  stop(): void {
    const song = this.prepared
    if (song === null) return
    const { barMap } = song.source
    const bar = this.loopRange?.startBar ?? barMap.firstBar
    this.hold(barMap.barStartTick(bar))
    this.silence()
    this.setState('stopped')
  }

  setTempoPercent(percent: number): void {
    if (!Number.isFinite(percent)) throw new RangeError(`Tempo must be finite, got ${percent}`)
    const position = this.position
    this.tempo = Math.min(MAX_TEMPO_PERCENT, Math.max(MIN_TEMPO_PERCENT, percent))
    // Re-anchor so the new rate applies from the current position instead of from the old anchor.
    if (this.currentState === 'playing') this.anchor(position)
  }

  seekToBar(bar: number): void {
    const song = this.prepared
    if (song === null) return
    const { barMap } = song.source
    const target = Math.min(barMap.barCount, Math.max(barMap.firstBar, Math.round(bar)))
    const tick = barMap.barStartTick(target)
    this.silence()
    if (this.currentState === 'playing') this.startFrom(tick)
    else this.hold(tick)
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
  }

  setPreRoll(config: PreRollConfig): void {
    const beats = Number.isFinite(config.beats) ? Math.max(0, Math.floor(config.beats)) : 0
    this.preRollConfig = { ...config, beats }
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
        }
        return
      }
    } else if (newPos >= song.endSec) {
      this.process(this.lastPos, song.endSec, true)
      this.stop()
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
    const { barMap, tempoMap } = song.source
    const targetSec = tempoMap.tickToSeconds(targetTick)
    const beats = this.preRollConfig.beats
    if (beats > 0) {
      const bar = barMap.tickToPosition(targetTick).bar
      const ticksPerBeat = barMap.ticksPerBeat(bar)
      const beatSec = (ticksPerBeat * tempoMap.secondsPerQuarterAt(targetTick)) / tempoMap.ppq
      this.window = {
        startSec: targetSec - beats * beatSec,
        endSec: targetSec,
        targetTick,
        beats,
        beatSec,
        ticksPerBeat,
      }
    } else {
      this.window = null
    }
    const start = this.window?.startSec ?? targetSec
    this.anchor(start)
    this.lastPos = start
    this.armedTick = null
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
    const song = this.prepared
    if (song === null) return
    const { barMap, tempoMap } = song.source
    const window = this.window
    const pushBeat = (time: number, tick: number, isPreRoll: boolean): void => {
      const { bar, beat } = barMap.tickToPosition(tick)
      events.push({ time, order: 2, fire: () => this.bus.emit('beat', { bar, beat, isPreRoll }) })
    }

    // Count-in beats are spaced by the target's tempo, not the song's tempo before the target.
    if (window !== null) {
      for (let k = window.beats; k >= 1; k--) {
        const time = window.endSec - k * window.beatSec
        if (time >= from && time < to) {
          pushBeat(time, window.targetTick - k * window.ticksPerBeat, true)
        }
      }
    }

    const gridFrom = window === null ? from : Math.max(from, window.endSec)
    if (gridFrom >= to) return
    // Widen the tick range by one tick and filter in seconds, so float rounding at the
    // boundaries can neither drop nor duplicate a beat between consecutive updates.
    const fromTick = tempoMap.secondsToTick(gridFrom) - 1
    const toTick = tempoMap.secondsToTick(to) + 1
    for (const tick of barMap.beatTicksBetween(fromTick, toTick)) {
      const time = tempoMap.tickToSeconds(tick)
      if (time >= gridFrom && time < to) pushBeat(time, tick, false)
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
