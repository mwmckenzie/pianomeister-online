import type { RecorderEntry, RecorderEvent } from './RecorderEvent'
import type { PlaySetup } from './PlaySetup'
import type { RecorderWrite } from './RecorderWrite'
import { SESSION_GAP_MS } from './SESSION_GAP_MS'
import type { Session } from './Session'

interface Stretch {
  readonly id: string
  readonly entry: RecorderEntry
  readonly setup: PlaySetup
  readonly sessionId: string
  readonly startedAt: number
  passes: number
}

/** Until the player says otherwise: 100%, the whole song, no metronome. */
const DEFAULT_SETUP: PlaySetup = {
  tempoPercent: 100,
  loop: null,
  metronomeMode: 'off',
  temporary: false,
}

function sameSetup(a: PlaySetup, b: PlaySetup): boolean {
  return (
    a.tempoPercent === b.tempoPercent &&
    a.metronomeMode === b.metronomeMode &&
    a.temporary === b.temporary &&
    a.loop?.startBar === b.loop?.startBar &&
    a.loop?.endBar === b.loop?.endBar
  )
}

/**
 * Turns the player's transport events into play-log writes (brief decision 70). Pure: it never
 * reads a clock or storage; every event carries `now`, and every write is returned.
 *
 * - A stretch is one record, rewritten on every tick (the player sends one each 30 s), on each
 *   counted pass, and when it ends (pause, stop, song end, load, tab hidden).
 * - Time always goes to the loaded entry. A pass counts when the range was covered from its
 *   start to a loop wrap or the song's end, and only while the effective range equals the
 *   entry's saved range. A seek or a range change voids the pass in progress; pausing doesn't.
 * - A stretch joins the current session unless the last playback was more than 10 minutes ago.
 * - Each record keeps the setup it was played with; a setup change mid-stretch ends the record
 *   and starts a new one (like a load, but the pass in progress carries on).
 */
export class PlayRecorder {
  private entry: RecorderEntry | null = null
  private stretch: Stretch | null = null
  private session: Session | null
  private passValid = false
  private rangeMatches = true
  private setup: PlaySetup = DEFAULT_SETUP

  constructor(
    private readonly newId: () => string,
    lastSession: Session | null = null,
  ) {
    this.session = lastSession
  }

  get playing(): boolean {
    return this.stretch !== null
  }

  handle(event: RecorderEvent): RecorderWrite | null {
    switch (event.type) {
      case 'load': {
        const write = this.endStretch(event.now)
        this.entry = event.entry
        this.passValid = false
        this.rangeMatches = true
        return write
      }
      case 'play':
        if (this.stretch !== null) return null
        this.passValid = event.atRangeStart || this.passValid
        this.rangeMatches = event.rangeMatches
        this.startStretch(event.now)
        return null
      case 'visible':
        if (event.playing && this.stretch === null) this.startStretch(event.now)
        return null
      case 'pause':
      case 'stop':
      case 'hidden':
        return this.endStretch(event.now)
      case 'seek':
        this.passValid = event.atRangeStart
        return null
      case 'range':
        this.rangeMatches = event.matchesSaved
        this.passValid = false
        return null
      case 'wrap': {
        const counted = this.countPass()
        this.passValid = true
        return counted ? this.write(event.now) : null
      }
      case 'end': {
        this.countPass()
        this.passValid = false
        return this.endStretch(event.now)
      }
      case 'setup': {
        const changed = !sameSetup(this.setup, event.setup)
        this.setup = event.setup
        if (!changed || this.stretch === null) return null
        const write = this.endStretch(event.now)
        this.startStretch(event.now)
        return write
      }
      case 'tick':
        return this.stretch === null ? null : this.write(event.now)
    }
  }

  private countPass(): boolean {
    if (this.stretch === null || !this.passValid || !this.rangeMatches) return false
    this.stretch.passes += 1
    return true
  }

  private startStretch(now: number): void {
    const entry = this.entry
    if (entry === null) return
    const session = this.session
    const joins =
      session !== null &&
      session.profileId === entry.profileId &&
      now - session.endedAt <= SESSION_GAP_MS
    this.session = joins
      ? session
      : { id: this.newId(), profileId: entry.profileId, startedAt: now, endedAt: now }
    this.stretch = {
      id: this.newId(),
      entry,
      setup: this.setup,
      sessionId: this.session?.id ?? '',
      startedAt: now,
      passes: 0,
    }
  }

  private endStretch(now: number): RecorderWrite | null {
    if (this.stretch === null) return null
    const write = this.write(now)
    this.stretch = null
    return write
  }

  private write(now: number): RecorderWrite | null {
    const stretch = this.stretch
    const session = this.session
    if (stretch === null || session === null) return null
    const endedAt = Math.max(session.endedAt, now)
    this.session = { ...session, endedAt }
    return {
      record: {
        id: stretch.id,
        profileId: stretch.entry.profileId,
        sessionId: stretch.sessionId,
        songId: stretch.entry.songId,
        bookmarkId: stretch.entry.entryId,
        startedAt: stretch.startedAt,
        playedMs: Math.max(0, now - stretch.startedAt),
        passes: stretch.passes,
        ...stretch.setup,
      },
      session: this.session,
    }
  }
}
