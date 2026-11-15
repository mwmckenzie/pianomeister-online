import type { BarMap } from '../timing/BarMap'
import type { TempoMap } from '../timing/TempoMap'
import type { BeatEvent } from './BeatEvent'
import type { PreRollWindow } from './PreRollWindow'

/**
 * Beats with songSec in [fromSec, toSec), in order. Inside a pre-roll window the count-in
 * beats are spaced by the target's tempo (not the song's tempo before the target); from the
 * target on, beats follow the bar map.
 */
export function beatsBetween(
  barMap: BarMap,
  tempoMap: TempoMap,
  window: PreRollWindow | null,
  fromSec: number,
  toSec: number,
): BeatEvent[] {
  const out: BeatEvent[] = []
  if (toSec <= fromSec) return out
  const push = (songSec: number, tick: number, isPreRoll: boolean): void => {
    const { bar, beat } = barMap.tickToPosition(tick)
    out.push({ bar, beat, isDownbeat: beat === 1, isPreRoll, songSec })
  }

  if (window !== null) {
    for (let k = window.beats; k >= 1; k--) {
      const songSec = window.endSec - k * window.beatSec
      if (songSec >= fromSec && songSec < toSec) {
        push(songSec, window.targetTick - k * window.ticksPerBeat, true)
      }
    }
  }

  const gridFrom = window === null ? fromSec : Math.max(fromSec, window.endSec)
  if (gridFrom < toSec) {
    // Widen the tick range by one tick and filter in seconds, so float rounding at the
    // boundaries can neither drop nor duplicate a beat between consecutive calls.
    const fromTick = tempoMap.secondsToTick(gridFrom) - 1
    const toTick = tempoMap.secondsToTick(toSec) + 1
    for (const tick of barMap.beatTicksBetween(fromTick, toTick)) {
      const songSec = tempoMap.tickToSeconds(tick)
      if (songSec >= gridFrom && songSec < toSec) push(songSec, tick, false)
    }
  }
  return out
}
