import type { BarLayout } from './BarLayout'

/** The bar containing `tick`, clamped to the song's bars. */
export function barAtTick(layout: BarLayout, tick: number): number {
  const { bars } = layout
  let lo = 0
  let hi = bars.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((bars[mid]?.startTick ?? Infinity) <= tick) lo = mid
    else hi = mid - 1
  }
  return bars[lo]?.bar ?? layout.firstBar
}
