import { watch } from 'vue'

import { PlayRecorder } from '@/core/stats/PlayRecorder'
import type { RecorderEvent } from '@/core/stats/RecorderEvent'

import { usePracticeStore } from '../stores/practiceStore'
import { useProfileStore } from '../stores/profileStore'
import { useStatsStore } from '../stores/statsStore'
import type { PlaybackSession } from './PlaybackSession'

/** How often a playing stretch is saved, so a crash or closed tab loses at most this much. */
export const PLAY_LOG_INTERVAL_MS = 30_000

let attached: PlaybackSession | null = null

/**
 * Feeds the shared session's transport into the play recorder and stores what it writes
 * (brief decision 70). Attached once for the page's lifetime, like the session itself; nothing
 * runs per frame — only on transport events, setup changes, a 30 s timer while playing, and tab
 * visibility.
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

  /** The setup in effect and what it matches exactly; a change splits the record. */
  function sendSetup(): void {
    send({
      type: 'setup',
      setup: practice.current,
      entryId: practice.now?.entryId ?? null,
      now: Date.now(),
    })
  }

  /** A load: the next Play is a start (and one under way counts at once). */
  function load(): void {
    const songId = practice.songId
    send({
      type: 'load',
      entry: songId === null ? null : { profileId: profiles.activeId, songId },
      now: Date.now(),
    })
    sendSetup()
    if (transport.state === 'playing') send({ type: 'play', now: Date.now() })
  }

  session.bus.on('timelineChange', ({ reason }) => {
    switch (reason) {
      case 'play':
      case 'pause':
      case 'stop':
      case 'end':
        send({ type: reason, now: Date.now() })
        break
    }
  })
  session.bus.on('loopWrap', () => send({ type: 'wrap', now: Date.now() }))

  // Registered first, so a loop change reaches the recorder (a new record) before its jump.
  watch(() => [practice.current, practice.now?.entryId] as const, sendSetup)
  // A load arms a start; a committed loop change's jump to the loop start is one (decision 70).
  // Loading a bookmark also jumps: that's the load's start, not another.
  watch(
    () => [practice.loads, practice.loopJump] as const,
    ([loads], [loadsBefore]) => {
      if (loads !== loadsBefore) load()
      else send({ type: 'jump', now: Date.now() })
    },
  )
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

  // What's loaded now, then the stored last session once it's read. The recorder is kept, not
  // replaced: replacing it would re-arm a start, so a resume could count as a play.
  load()
  void stats.lastSession().then((last) => recorder.continueSession(last))
}
