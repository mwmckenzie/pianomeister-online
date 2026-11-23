import type { BarMap } from '../timing/BarMap'
import type { TempoMap } from '../timing/TempoMap'
import type { PreRollWindow } from './PreRollWindow'

/**
 * The count-in of `beats` before `targetTick`, spaced at the tempo and meter of the target bar
 * (brief decision 10), or null for none. It can start before the song (negative seconds): the
 * highway then runs empty for the part before bar 1.
 */
export function preRollWindowFor(
  barMap: BarMap,
  tempoMap: TempoMap,
  targetTick: number,
  beats: number,
): PreRollWindow | null {
  if (beats <= 0) return null
  const targetSec = tempoMap.tickToSeconds(targetTick)
  const ticksPerBeat = barMap.ticksPerBeat(barMap.tickToPosition(targetTick).bar)
  const beatSec = (ticksPerBeat * tempoMap.secondsPerQuarterAt(targetTick)) / tempoMap.ppq
  return {
    startSec: targetSec - beats * beatSec,
    endSec: targetSec,
    targetTick,
    beats,
    beatSec,
    ticksPerBeat,
  }
}
