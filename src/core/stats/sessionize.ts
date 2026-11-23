import type { PlayRecord } from './PlayRecord'
import { DEFAULT_SESSION_GAP_MS } from './DEFAULT_SESSION_GAP_MS'
import { isNewSession } from './isNewSession'

/**
 * Groups play records into sessions (brief decision 5): a record more than `gapMs` (the "New
 * session after" setting) after the previous playback ended starts a new session (isNewSession). The same rule the recorder applies live, so
 * stats can be computed from the log alone.
 */
export function sessionize(
  records: readonly PlayRecord[],
  gapMs = DEFAULT_SESSION_GAP_MS,
): readonly (readonly PlayRecord[])[] {
  const sorted = [...records].sort((a, b) => a.startedAt - b.startedAt)
  const sessions: PlayRecord[][] = []
  let lastEnd: number | null = null
  for (const record of sorted) {
    const current = sessions[sessions.length - 1]
    if (current === undefined || isNewSession(lastEnd, record.startedAt, gapMs)) {
      sessions.push([record])
    } else current.push(record)
    lastEnd = Math.max(lastEnd ?? Number.NEGATIVE_INFINITY, record.startedAt + record.playedMs)
  }
  return sessions
}
