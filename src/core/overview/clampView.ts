import type { BarLayout } from './BarLayout'
import type { OverviewView } from './OverviewView'

/** Keeps a view inside the song and between the narrowest zoom (4 bars) and the whole song. */
export function clampView(view: OverviewView, layout: BarLayout): OverviewView {
  const total = layout.endTick - layout.startTick
  const span = Math.min(
    total,
    Math.max(layout.minSpan, Number.isFinite(view.span) ? view.span : total),
  )
  const start = Number.isFinite(view.startTick) ? view.startTick : layout.startTick
  return { startTick: Math.min(layout.endTick - span, Math.max(layout.startTick, start)), span }
}
