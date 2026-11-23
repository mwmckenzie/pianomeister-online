import type { BarMap } from '../timing/BarMap'
import type { TempoMap } from '../timing/TempoMap'
import type { LoopRange } from './LoopRange'
import type { LoopWindow } from './LoopWindow'
import { preRollWindowFor } from './preRollWindowFor'

/**
 * The loop's window on the highway: the same count-in the transport plays before each
 * iteration (Transport.windowFor), so a repeat drawn `periodTicks` later lands where the
 * playhead will actually be after the wrap. Null without a loop.
 */
export function loopWindowFor(
  loop: LoopRange | null,
  preRollBeats: number,
  barMap: BarMap,
  tempoMap: TempoMap,
): LoopWindow | null {
  if (loop === null) return null
  const startTick = barMap.barStartTick(loop.startBar)
  const endTick = barMap.barEndTick(loop.endBar)
  const preRoll = preRollWindowFor(barMap, tempoMap, startTick, preRollBeats)
  const preStartTick = preRoll === null ? startTick : tempoMap.secondsToTick(preRoll.startSec)
  return { startTick, endTick, preStartTick, periodTicks: endTick - preStartTick }
}
