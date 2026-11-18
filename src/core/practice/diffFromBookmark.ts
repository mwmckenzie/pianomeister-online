import type { LoopRange } from '../transport/LoopRange'
import type { PracticeConfig } from './PracticeConfig'
import type { PracticeField } from './PracticeField'

/** Two ranges cover the same bars; null (the whole song) only equals null. */
export function sameRange(a: LoopRange | null, b: LoopRange | null): boolean {
  if (a === null || b === null) return a === b
  return a.startBar === b.startBar && a.endBar === b.endBar
}

/**
 * The fields where the player's current setup differs from the loaded bookmark's saved one:
 * its temporary changes (brief decision 69). Empty means the HUD shows no dot.
 */
export function diffFromBookmark(
  saved: PracticeConfig,
  current: PracticeConfig,
): readonly PracticeField[] {
  const changed: PracticeField[] = []
  if (!sameRange(saved.loop, current.loop)) changed.push('loop')
  if (saved.tempoPercent !== current.tempoPercent) changed.push('tempoPercent')
  if (saved.handAudio.right !== current.handAudio.right) changed.push('handAudio.right')
  if (saved.handAudio.left !== current.handAudio.left) changed.push('handAudio.left')
  if (saved.preRollBeats !== current.preRollBeats) changed.push('preRollBeats')
  if (saved.preRollMode !== current.preRollMode) changed.push('preRollMode')
  if (saved.metronomeMode !== current.metronomeMode) changed.push('metronomeMode')
  return changed
}
