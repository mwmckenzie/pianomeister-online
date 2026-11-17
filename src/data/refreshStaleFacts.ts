import { computeSongFacts } from '@/core/library/computeSongFacts'
import { FACTS_VERSION } from '@/core/library/FACTS_VERSION'
import { needsFactsRefresh } from '@/core/library/needsFactsRefresh'
import { parseMidi } from '@/core/song/parseMidi'

import type { PianoMeisterDb } from './PianoMeisterDb'

/** appState key remembering the FACTS_VERSION at which an upload couldn't be re-read. */
export const factsFailureKey = (songId: string): string => `factsRefreshFailed:${songId}`

/** Lets the browser render and handle input between two files. */
const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Recomputes the facts of uploads stored with an older FACTS_VERSION (or none), one file at a
 * time, yielding to the UI between files, and calls `onRefreshed` after each save so the list
 * can update. A file that no longer parses keeps its old facts, and the failure is remembered
 * (by its content hash and FACTS_VERSION), so it isn't retried on every load.
 */
export async function refreshStaleFacts(
  db: PianoMeisterDb,
  onRefreshed: (songId: string) => void | Promise<void> = () => undefined,
): Promise<{ readonly refreshed: readonly string[]; readonly failed: readonly string[] }> {
  const uploads = await db.uploads.toArray()
  const failures = new Map(
    (await db.appState.bulkGet(uploads.map((u) => factsFailureKey(u.songId)))).map((row, i) => [
      uploads[i]?.songId,
      row === undefined ? null : Number(row.value),
    ]),
  )
  const refreshed: string[] = []
  const failed: string[] = []
  for (const upload of uploads) {
    if (!needsFactsRefresh(upload.facts, failures.get(upload.songId) ?? null)) continue
    await yieldToUi()
    let facts
    try {
      facts = computeSongFacts(
        parseMidi(new Uint8Array(upload.bytes), { fileName: upload.fileName }),
      )
    } catch (e) {
      console.warn(`[library] Couldn't re-read ${upload.fileName}; keeping its stored facts.`, e)
      await db.appState.put({ key: factsFailureKey(upload.songId), value: String(FACTS_VERSION) })
      failed.push(upload.songId)
      continue
    }
    await db.uploads.update(upload.songId, { facts })
    refreshed.push(upload.songId)
    await onRefreshed(upload.songId)
  }
  return { refreshed, failed }
}
