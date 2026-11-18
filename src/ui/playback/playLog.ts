import { watch } from 'vue'

import { PlayRecorder } from '@/core/stats/PlayRecorder'
import type { RecorderEvent } from '@/core/stats/RecorderEvent'

import { usePracticeStore } from '../stores/practiceStore'
import { useProfileStore } from '../stores/profileStore'
import { useStatsStore } from '../stores/statsStore'
import type { PlaybackSession } from './PlaybackSession'

/** How often a playing stretch is saved, so a crash or closed tab loses at most this much. */
export const PLAY_LOG_INTERVAL_MS = 30_000

/** Seconds of slack when deciding whether playback is at the range start. */
const AT_START_SLACK = 0.05

let attached: PlaybackSession | null = null

/**
 * Feeds the shared session's transport into the play recorder and stores what it writes
 * (brief decision 70). Attached once for the page's lifetime, like the session itself; nothing
 * runs per frame — only on transport events, a 30 s timer while playing, and tab visibility.
 */
export function attachPlayLog(session: PlaybackSession): void {
  if (attached === session) return
  attached = session
  const practice = usePracticeStore()
  const profiles = useProfileStore()
  const stats = useStatsStore()
  const { transport } = session

  let recorder = new PlayRecorder(() => crypto.randomUUID())
  let timer: ReturnType<typeof setInterval> | undefined

  function send(event: RecorderEvent): void {
    const write = recorder.handle(event)
    if (write !== null) {
      stats.record(write).catch((e: unknown) => console.error("[stats] Couldn't save practice:", e))
    }
    clearInterval(timer)
    timer = recorder.playing
      ? setInterval(() => send({ type: 'tick', now: Date.now() }), PLAY_LOG_INTERVAL_MS)
      : undefined
  }

  /** Playback is at the effective range's first bar, or in the pre-roll leading into it. */
  function atRangeStart(): boolean {
    const song = session.song
    if (song === null) return false
    const loop = practice.current.loop
    const startTick = song.barMap.barStartTick(loop?.startBar ?? song.barMap.firstBar)
    return transport.position <= song.tempoMap.tickToSeconds(startTick) + AT_START_SLACK
  }

  /** What the recorder was last told about the range; a change voids the pass under way. */
  let rangeSent: { matches: boolean; loop: string } | null = null

  function load(): void {
    const songId = practice.songId
    const entryId = practice.entryId
    send({
      type: 'load',
      entry:
        songId === null || entryId === null
          ? null
          : { profileId: profiles.activeId, songId, entryId },
      now: Date.now(),
    })
    sendSetup()
    // A load starts afresh with the range as it is now.
    rangeSent = { matches: practice.rangeMatchesSaved, loop: JSON.stringify(practice.current.loop) }
  }

  /** The setup each record keeps; a change mid-stretch starts a new record (decision 70). */
  function sendSetup(): void {
    const { tempoPercent, loop, metronomeMode } = practice.current
    send({
      type: 'setup',
      setup: { tempoPercent, loop, metronomeMode, temporary: practice.changed.length > 0 },
      now: Date.now(),
    })
  }

  function sendRange(): void {
    const next = {
      matches: practice.rangeMatchesSaved,
      loop: JSON.stringify(practice.current.loop),
    }
    if (rangeSent !== null && rangeSent.matches === next.matches && rangeSent.loop === next.loop)
      return
    rangeSent = next
    send({ type: 'range', matchesSaved: next.matches, now: Date.now() })
  }

  session.bus.on('timelineChange', ({ reason }) => {
    const now = Date.now()
    switch (reason) {
      case 'loop':
        // Synchronously, before the jump to the new loop start that may follow (decision 8):
        // that seek then starts a valid pass.
        sendRange()
        break
      case 'play':
        send({
          type: 'play',
          atRangeStart: atRangeStart(),
          rangeMatches: practice.rangeMatchesSaved,
          now,
        })
        break
      case 'pause':
      case 'stop':
        send({ type: reason, now })
        break
      case 'end':
        send({ type: 'end', now })
        break
      case 'seek':
        send({ type: 'seek', atRangeStart: atRangeStart(), now })
        break
      case 'resync':
        // A whole loop pass was skipped (e.g. in a background tab): not a complete pass.
        send({ type: 'seek', atRangeStart: false, now })
        break
    }
  })
  session.bus.on('loopWrap', () => send({ type: 'wrap', now: Date.now() }))

  // What the time is attributed to: another song or bookmark ends the stretch (a profile
  // switch is handled below, with that profile's last session).
  watch(
    () => [practice.songId, practice.entryId] as const,
    () => {
      load()
      if (transport.state === 'playing') {
        send({
          type: 'play',
          atRangeStart: atRangeStart(),
          rangeMatches: practice.rangeMatchesSaved,
          now: Date.now(),
        })
      }
    },
  )
  // Passes count only while the range equals the saved one. Most changes arrive above with
  // the transport's loop change; this catches the rest (e.g. the saved range edited).
  watch(() => [practice.rangeMatchesSaved, practice.current.loop] as const, sendRange)
  watch(() => [practice.current, practice.changed] as const, sendSetup)
  // A new profile continues its own last session, if it was recent.
  watch(
    () => profiles.activeId,
    async () => {
      send({ type: 'stop', now: Date.now() })
      recorder = new PlayRecorder(() => crypto.randomUUID(), await stats.lastSession())
      load()
    },
  )

  document.addEventListener('visibilitychange', () => {
    const now = Date.now()
    if (document.visibilityState === 'hidden') send({ type: 'hidden', now })
    else send({ type: 'visible', playing: transport.state === 'playing', now })
  })
  window.addEventListener('pagehide', () => send({ type: 'hidden', now: Date.now() }))

  void stats.lastSession().then((last) => {
    if (!recorder.playing) recorder = new PlayRecorder(() => crypto.randomUUID(), last)
    load()
  })
}
