import type { BarLayout } from './BarLayout'
import { clampView } from './clampView'
import type { OverviewView } from './OverviewView'

/**
 * A zoom preset: `count` bars from the bar at `fromTick` (null = the whole song). Near the end
 * the view shifts left so it is still `count` bars wide.
 */
export function viewForBars(
  layout: BarLayout,
  count: number | null,
  fromTick: number,
): OverviewView {
  const whole = { startTick: layout.startTick, span: layout.endTick - layout.startTick }
  const { bars } = layout
  if (count === null || count >= bars.length) return whole
  let index = bars.findIndex((b) => b.endTick > fromTick)
  if (index < 0) index = bars.length - 1
  index = Math.max(0, Math.min(index, bars.length - count))
  const first = bars[index]
  const last = bars[index + count - 1]
  if (first === undefined || last === undefined) return whole
  return clampView({ startTick: first.startTick, span: last.endTick - first.startTick }, layout)
}
