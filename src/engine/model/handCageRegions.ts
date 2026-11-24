import type { HandCage } from '@/core/cages/HandCage'
import { handCageRuns } from '@/core/cages/handCageRuns'

import type { CageRegion } from './CageRegion'

/**
 * One hand's cages as cage-layer regions (milestone 10): runs of equal keys joined, played and
 * carried pieces of one region sharing its span (fills, stripes and corners follow the region).
 * Cages of different playlist songs (decks) never join.
 */
export function handCageRegions(
  cages: readonly (HandCage & { readonly deck?: number })[],
): CageRegion[] {
  const out: CageRegion[] = []
  let group: (HandCage & { readonly deck?: number })[] = []
  const flush = () => {
    const deck = group[0]?.deck
    const runs = handCageRuns(group)
    let first = 0
    runs.forEach((run, i) => {
      if (!run.openStart) first = i
      if (run.openEnd) return
      // Runs first..i are one region: they share its span.
      const spanStart = runs[first]?.startTick ?? run.startTick
      for (const piece of runs.slice(first, i + 1)) {
        out.push({
          startTick: piece.startTick,
          endTick: piece.endTick,
          lowMidi: piece.low,
          highMidi: piece.high,
          openStart: piece.openStart,
          openEnd: piece.openEnd,
          spanStart,
          spanEnd: run.endTick,
          carried: piece.carried,
          ...(deck === undefined ? {} : { deck }),
        })
      }
    })
    group = []
  }
  for (const cage of cages) {
    if (group.length > 0 && group[0]?.deck !== cage.deck) flush()
    group.push(cage)
  }
  flush()
  return out
}
