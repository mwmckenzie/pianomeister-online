import type { PlayRecord } from './PlayRecord'
import { SESSION_GAP_MS } from './SESSION_GAP_MS'

/**
 * Groups play records into sessions (brief decision 5): a record more than `gapMs` after the
 * previous playback ended starts a new session. The same rule the recorder applies live, so
 * stats can be computed from the log alone.
 */
export function sessionize(
  records: readonly PlayRecord[],
  gapMs = SESSION_GAP_MS,
): readonly (readonly PlayRecord[])[] {
  const sorted = [...records].sort((a, b) => a.startedAt - b.startedAt)
  const sessions: PlayRecord[][] = []
  let lastEnd = Number.NEGATIVE_INFINITY
  for (const record of sorted) {
    const current = sessions[sessions.length - 1]
    if (current === undefined || record.startedAt - lastEnd > gapMs) sessions.push([record])
    else current.push(record)
    lastEnd = Math.max(lastEnd, record.startedAt + record.playedMs)
  }
  return sessions
}
