import type { HandCage } from './HandCage'
import type { HandCageRun } from './HandCageRun'

/**
 * One hand's cages as drawn pieces (milestone 10): consecutive bars with the same keys join into
 * one region with no line between bars, played and carried alike; a change of keys (or a gap)
 * starts a new region. Inside a region, played and carried bars are separate pieces (they draw at
 * different strengths) that meet with open ends.
 */
export function handCageRuns(cages: readonly HandCage[]): HandCageRun[] {
  const runs: HandCageRun[] = []
  for (const cage of cages) {
    const last = runs[runs.length - 1]
    const sameRegion =
      last !== undefined &&
      last.endTick === cage.startTick &&
      last.low === cage.low &&
      last.high === cage.high
    if (sameRegion && last.carried === cage.carried) {
      runs[runs.length - 1] = { ...last, endTick: cage.endTick }
      continue
    }
    if (sameRegion) runs[runs.length - 1] = { ...last, openEnd: true }
    runs.push({
      startTick: cage.startTick,
      endTick: cage.endTick,
      low: cage.low,
      high: cage.high,
      carried: cage.carried,
      openStart: sameRegion,
      openEnd: false,
    })
  }
  return runs
}
