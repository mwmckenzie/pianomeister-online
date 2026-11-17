import type { PreRollWindow } from './PreRollWindow'

const EPSILON = 1e-9

/** Which count-in beat (1-based, 1…beats) is playing at `positionSec` inside a pre-roll window. */
export function preRollBeat(window: PreRollWindow, positionSec: number): number {
  const beat = Math.floor((positionSec - window.startSec) / window.beatSec + EPSILON) + 1
  return Math.min(window.beats, Math.max(1, beat))
}
