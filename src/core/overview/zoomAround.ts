import type { BarLayout } from './BarLayout'
import { clampView } from './clampView'
import type { OverviewView } from './OverviewView'

/**
 * Zooms by `factor` (< 1 zooms in) keeping `anchorTick` under the pointer: the anchor's
 * fraction of the view stays the same, unless clamping at the song's ends moves it.
 */
export function zoomAround(
  view: OverviewView,
  factor: number,
  anchorTick: number,
  layout: BarLayout,
): OverviewView {
  const fraction = view.span === 0 ? 0 : (anchorTick - view.startTick) / view.span
  const total = layout.endTick - layout.startTick
  const span = Math.min(total, Math.max(layout.minSpan, view.span * factor))
  return clampView({ startTick: anchorTick - fraction * span, span }, layout)
}
