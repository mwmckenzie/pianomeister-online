import type { BarMap } from '../timing/BarMap'
import type { BarLayout } from './BarLayout'
import type { BarSpan } from './BarSpan'

/** Bars shown in the narrowest zoom (brief decision 104). */
const MIN_BARS = 4

/**
 * The song's bars in ticks, from the bar map (meter changes and a pickup bar 0 included). The
 * last bar runs to its full length even if the song ends earlier, as the timeline shows it.
 */
export function layoutBars(
  barMap: Pick<
    BarMap,
    'firstBar' | 'barCount' | 'barStartTick' | 'barEndTick' | 'beatTicksBetween'
  >,
): BarLayout {
  const firstBar = barMap.firstBar
  const lastBar = Math.max(firstBar, barMap.barCount)
  const bars: BarSpan[] = []
  for (let bar = firstBar; bar <= lastBar; bar++) {
    const startTick = barMap.barStartTick(bar)
    const endTick = barMap.barEndTick(bar)
    bars.push({
      bar,
      startTick,
      endTick,
      beatTicks: barMap.beatTicksBetween(startTick, endTick).filter((t) => t > startTick),
      strong: bar >= 1 && (bar - 1) % 4 === 0,
    })
  }
  const startTick = bars[0]?.startTick ?? 0
  const endTick = Math.max(startTick + 1, bars[bars.length - 1]?.endTick ?? 1)
  const total = endTick - startTick
  return {
    bars,
    firstBar,
    lastBar,
    startTick,
    endTick,
    // Four of the shortest bars, so any four bars fit a preset or the narrowest zoom (a short
    // pickup bar 0 doesn't count).
    minSpan: Math.min(total, shortestBar(bars) * MIN_BARS),
  }
}

function shortestBar(bars: readonly BarSpan[]): number {
  const counted = bars.filter((b) => b.bar >= 1)
  return Math.min(...(counted.length > 0 ? counted : bars).map((b) => b.endTick - b.startTick))
}
