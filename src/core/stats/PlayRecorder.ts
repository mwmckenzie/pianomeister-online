import { sameBookmarkSettings } from '../practice/sameBookmarkSettings'
import type { PlaySetup } from './PlaySetup'
import type { RecorderEntry, RecorderEvent } from './RecorderEvent'
import type { RecorderWrite } from './RecorderWrite'
import { DEFAULT_SESSION_GAP_MS } from './DEFAULT_SESSION_GAP_MS'
import { isNewSession } from './isNewSession'
import type { Session } from './Session'

interface Stretch {
  readonly id: string
  readonly entry: RecorderEntry
  readonly entryId: string | null
  readonly setup: PlaySetup
  readonly sessionId: string
  readonly startedAt: number
  plays: number
}

/** Until the player says otherwise: the whole song at 100%, both hands, no pre-roll. */
const DEFAULT_SETUP: PlaySetup = {
  loop: null,
  tempoPercent: 100,
  handAudio: { right: 'on', left: 'on' },
  preRollBeats: 0,
  preRollMode: 'muted',
  metronomeMode: 'off',
}

const sameSetup = (a: PlaySetup, b: PlaySetup): boolean =>
  sameBookmarkSettings({ songId: '', config: a }, { songId: '', config: b })

/**
 * Turns the player's transport events into play-log writes (brief decision 70). Pure: it never
 * reads a clock or storage; every event carries `now`, and every write is returned.
 *
 * - **A play is a start:** the first Play after a load, a Stop or the song's end (a timeline
 *   click in between changes nothing), every loop wrap, and every committed loop change's jump
 *   to the new loop start (at once while playing; else the next Play counts). Resuming after a
 *   pause is not a play, wherever the playhead was moved meanwhile.
 * - **Attribution:** each stretch keeps the setup and what it matched exactly (a bookmark, Full
 *   song, or null for other setups); a change of either ends the record and starts another.
 * - A stretch is one record, rewritten on every tick (the player sends one each 30 s), on each
 *   play counted, and when it ends (pause, stop, song end, load, tab hidden).
 * - A stretch joins the current session unless the last playback ended more than the gap ago
 *   (the "New session after" setting, isNewSession), across reloads too (continueSession).
 * - **Tracking suspended** (playlist mode, 9.5): nothing is recorded; a stretch under way ends.
 */
export class PlayRecorder {
  private entry: RecorderEntry | null = null
  private stretch: Stretch | null = null
  private session: Session | null
  /** The next Play is a start. */
  private armed = false
  private setup: PlaySetup = DEFAULT_SETUP
  private entryId: string | null = null
  private gapMs = DEFAULT_SESSION_GAP_MS
  private suspended = false

  constructor(
    private readonly newId: () => string,
    lastSession: Session | null = null,
  ) {
    this.session = lastSession
  }

  /**
   * The profile's last stored session, read after the recorder started: the next stretch may
   * continue it. Ignored once a session is under way (the recorder already has one).
   */
  continueSession(lastSession: Session | null): void {
    if (this.session === null) this.session = lastSession
  }

  /** The "New session after" setting, in ms. */
  setGap(gapMs: number): void {
    this.gapMs = gapMs
  }

  /**
   * Tracking suspended (for playlist mode, 9.5): while on, nothing is recorded, no sessions,
   * time or plays. Turning it on ends a stretch under way (its write is returned); loads and
   * setup changes are still followed, so tracking resumes with the right song.
   */
  setSuspended(suspended: boolean, now: number): RecorderWrite | null {
    if (suspended === this.suspended) return null
    const write = suspended ? this.endStretch(now) : null
    this.suspended = suspended
    return write
  }

  get playing(): boolean {
    return this.stretch !== null
  }

  handle(event: RecorderEvent): RecorderWrite | null {
    if (this.suspended) {
      this.follow(event)
      return null
    }
    switch (event.type) {
      case 'load': {
        const write = this.endStretch(event.now)
        this.entry = event.entry
        this.armed = true
        return write
      }
      case 'setup': {
        const changed = !sameSetup(this.setup, event.setup) || this.entryId !== event.entryId
        this.setup = event.setup
        this.entryId = event.entryId
        if (!changed || this.stretch === null) return null
        const write = this.endStretch(event.now)
        this.startStretch(event.now)
        return write
      }
      case 'play': {
        if (this.stretch !== null) return null
        this.startStretch(event.now)
        if (!this.armed || this.stretch === null) return null
        this.armed = false
        return this.countPlay(event.now)
      }
      case 'visible':
        if (event.playing && this.stretch === null) this.startStretch(event.now)
        return null
      case 'pause':
      case 'hidden':
        return this.endStretch(event.now)
      case 'stop':
      case 'end':
        this.armed = true
        return this.endStretch(event.now)
      case 'wrap':
        return this.countPlay(event.now)
      case 'jump':
        if (this.stretch === null) {
          this.armed = true
          return null
        }
        return this.countPlay(event.now)
      case 'tick':
        return this.stretch === null ? null : this.write(event.now)
    }
  }

  /** While suspended: keep up with what's loaded and set up, record nothing. */
  private follow(event: RecorderEvent): void {
    if (event.type === 'load') {
      this.entry = event.entry
      this.armed = true
    } else if (event.type === 'setup') {
      this.setup = event.setup
      this.entryId = event.entryId
    }
  }

  private countPlay(now: number): RecorderWrite | null {
    if (this.stretch === null) return null
    this.stretch.plays += 1
    return this.write(now)
  }

  private startStretch(now: number): void {
    const entry = this.entry
    if (entry === null) return
    const session = this.session
    const joins =
      session !== null &&
      session.profileId === entry.profileId &&
      !isNewSession(session.endedAt, now, this.gapMs)
    this.session = joins
      ? session
      : { id: this.newId(), profileId: entry.profileId, startedAt: now, endedAt: now }
    this.stretch = {
      id: this.newId(),
      entry,
      entryId: this.entryId,
      setup: this.setup,
      sessionId: this.session?.id ?? '',
      startedAt: now,
      plays: 0,
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
        bookmarkId: stretch.entryId,
        startedAt: stretch.startedAt,
        playedMs: Math.max(0, now - stretch.startedAt),
        plays: stretch.plays,
        ...stretch.setup,
      },
      session: this.session,
    }
  }
}
