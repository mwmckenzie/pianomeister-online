import { BarMap } from '../timing/BarMap'
import type { MeterOverride } from '../timing/MeterOverride'
import type { SongFacts } from './SongFacts'

/** Bar count with an optional meter override, from facts alone (an override replaces the file meter). */
export function effectiveBars(facts: SongFacts, override: MeterOverride | null): number {
  if (override === null) return facts.bars
  const source = { ppq: facts.ppq, durationTicks: facts.durationTicks, timeSignatureEvents: [] }
  return BarMap.fromSong(source, override).barCount
}
