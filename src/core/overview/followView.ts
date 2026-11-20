import type { BarLayout } from './BarLayout'
import { clampView } from './clampView'
import type { OverviewView } from './OverviewView'

/** Where the playhead may be before the view pages: 5%–90% of the width. */
const LEFT = 0.05
const RIGHT = 0.9
/** After paging, the playhead sits 10% from the left. */
const LEAD = 0.1

/**
 * Follow (brief decision 104): the view pages so the playhead stays in sight, in steps rather
 * than scrolling every frame, so the notes layer is redrawn only now and then.
 */
export function followView(view: OverviewView, tick: number, layout: BarLayout): OverviewView {
  const at = (tick - view.startTick) / view.span
  if (at >= LEFT && at <= RIGHT) return view
  return clampView({ startTick: tick - LEAD * view.span, span: view.span }, layout)
}
