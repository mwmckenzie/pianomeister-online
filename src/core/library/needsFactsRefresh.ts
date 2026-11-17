import { FACTS_VERSION } from './FACTS_VERSION'
import type { SongFacts } from './SongFacts'

/**
 * True when stored facts are older than FACTS_VERSION (or carry no version) and recomputing them
 * hasn't already failed at this version: a file that couldn't be re-read isn't retried on every
 * load, only after the next FACTS_VERSION bump.
 */
export function needsFactsRefresh(facts: SongFacts, failedAtVersion: number | null): boolean {
  return (facts.factsVersion ?? 0) < FACTS_VERSION && failedAtVersion !== FACTS_VERSION
}
