import type { CameraPlacement } from './CameraPlacement'

/** World units per tick, so that `lookAheadTicks` ahead of the now line lands at the 1x point. */
export function unitsPerTick(placement: CameraPlacement, lookAheadTicks: number): number {
  return placement.lookAheadLength / Math.max(1, lookAheadTicks)
}
