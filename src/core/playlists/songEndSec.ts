import type { SoundingNote } from '../sustain/SoundingNote'
import type { TempoMap } from '../timing/TempoMap'
import { RELEASE_SEC } from './RELEASE_SEC'

/**
 * Where a song ends for a crossfade (milestone 9.5): its last note's release, so trailing silence
 * in the file doesn't count. 0 for a song without notes.
 */
export function songEndSec(notes: readonly SoundingNote[], tempoMap: TempoMap): number {
  let last = Number.NEGATIVE_INFINITY
  for (const n of notes) last = Math.max(last, n.soundEndTick)
  return Number.isFinite(last) ? tempoMap.tickToSeconds(last) + RELEASE_SEC : 0
}
