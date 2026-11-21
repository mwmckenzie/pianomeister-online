import type { CageRegion } from './CageRegion'
import { keyLayout } from './keyLayout'
import { KEYBOARD } from './KEYBOARD'

/** One cage instance in highway coordinates: x in world units, time in ticks. */
export interface CageQuad {
  readonly x0: number
  readonly x1: number
  readonly startTick: number
  readonly endTick: number
  readonly openStart: boolean
  readonly openEnd: boolean
}

/**
 * Regions as highway quads (brief decision 115). A key range spans from the left edge of its
 * lowest key's lane to the right edge of its highest key's lane — a black key's lane is its own
 * width, so a range starting or ending on a black key is that much narrower. Empty, reversed or
 * off-keyboard regions are dropped; key ranges are clamped to the 88 keys.
 */
export function cageQuads(regions: readonly CageRegion[]): readonly CageQuad[] {
  const keys = keyLayout()
  const out: CageQuad[] = []
  for (const r of regions) {
    if (!(r.endTick > r.startTick)) continue
    let x0 = 0
    let x1: number = KEYBOARD.width
    if (r.lowMidi !== null || r.highMidi !== null) {
      const low = Math.max(KEYBOARD.lowest, r.lowMidi ?? KEYBOARD.lowest)
      const high = Math.min(KEYBOARD.highest, r.highMidi ?? KEYBOARD.highest)
      if (high < low) continue
      const lowKey = keys[low - KEYBOARD.lowest]
      const highKey = keys[high - KEYBOARD.lowest]
      if (lowKey === undefined || highKey === undefined) continue
      x0 = lowKey.x
      x1 = highKey.x + highKey.width
    }
    out.push({
      x0,
      x1,
      startTick: r.startTick,
      endTick: r.endTick,
      openStart: r.openStart ?? false,
      openEnd: r.openEnd ?? false,
    })
  }
  return out
}
