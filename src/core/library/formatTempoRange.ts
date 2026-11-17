import type { SongFacts } from './SongFacts'

/** "120–126 bpm", or "126 bpm" for a constant tempo (brief decision 56). */
export function formatTempoRange(facts: SongFacts): string {
  const min = Math.round(facts.bpmMin ?? facts.bpm)
  const max = Math.round(facts.bpmMax ?? facts.bpm)
  return min === max ? `${min} bpm` : `${min}–${max} bpm`
}
