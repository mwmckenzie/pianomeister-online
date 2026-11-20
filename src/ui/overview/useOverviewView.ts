import { computed, ref, shallowRef, watch, type Ref } from 'vue'

import type { BarLayout } from '@/core/overview/BarLayout'
import { clampView } from '@/core/overview/clampView'
import { followView } from '@/core/overview/followView'
import type { OverviewView } from '@/core/overview/OverviewView'
import { viewForBars } from '@/core/overview/viewForBars'
import { zoomAround } from '@/core/overview/zoomAround'

/**
 * The overview's view and Follow (brief decision 104): the whole song to start with; zoomed
 * in, it pages along with the playhead while playing, until the user pans or zooms by hand —
 * then Follow stays off until the next Play or a click on the Follow chip.
 */
export function useOverviewView(
  layout: Ref<BarLayout | null>,
  tick: Ref<number>,
  playing: Ref<boolean>,
) {
  const view = shallowRef<OverviewView>({ startTick: 0, span: 1 })
  const follow = ref(true)

  const total = computed(() => {
    const l = layout.value
    return l === null ? 1 : l.endTick - l.startTick
  })
  const whole = computed(() => view.value.span >= total.value - 1)

  function set(next: OverviewView, byUser: boolean): void {
    const l = layout.value
    if (l === null) return
    view.value = clampView(next, l)
    if (byUser && !whole.value) follow.value = false
  }

  /** A new song: the whole of it. */
  watch(
    layout,
    (l) => {
      if (l !== null) view.value = { startTick: l.startTick, span: l.endTick - l.startTick }
    },
    { immediate: true },
  )
  watch(playing, (now) => {
    if (now) follow.value = true
  })
  watch(tick, (t) => {
    const l = layout.value
    if (l === null || !follow.value || !playing.value || whole.value) return
    const next = followView(view.value, t, l)
    if (next !== view.value) view.value = next
  })

  /** Where zoom presets and the slider zoom around: the playhead if it's in view, else the middle. */
  function anchor(): number {
    const v = view.value
    const t = tick.value
    return t >= v.startTick && t <= v.startTick + v.span ? t : v.startTick + v.span / 2
  }

  /** The zoom slider (0 = whole song … 1 = 4 bars), logarithmic so each step feels the same. */
  const zoom = computed({
    get: () => {
      const l = layout.value
      if (l === null || l.minSpan >= total.value) return 0
      return Math.log(view.value.span / total.value) / Math.log(l.minSpan / total.value)
    },
    set: (fraction: number) => {
      const l = layout.value
      if (l === null) return
      const span = total.value * (l.minSpan / total.value) ** Math.min(1, Math.max(0, fraction))
      set(zoomAround(view.value, span / view.value.span, anchor(), l), false)
      if (playing.value) follow.value = true
    },
  })

  /**
   * How many bars wide the view is (rounded, from the average bar), or null for the whole song:
   * the zoom label and the presets. From the width, so panning doesn't change it.
   */
  const barsShown = computed((): number | null => {
    const l = layout.value
    if (l === null || whole.value) return null
    return Math.max(1, Math.round(view.value.span / (total.value / l.bars.length)))
  })

  /** A preset: N bars from the bar at the view's start (or the playhead's, when following). */
  function showBars(count: number | null): void {
    const l = layout.value
    if (l === null) return
    const from =
      follow.value && playing.value ? tick.value - view.value.span * 0.1 : view.value.startTick
    view.value = viewForBars(l, count, Math.max(l.startTick, from))
  }

  function resumeFollow(): void {
    follow.value = true
    const l = layout.value
    if (l !== null && !whole.value) {
      view.value = clampView(
        { startTick: tick.value - view.value.span * 0.1, span: view.value.span },
        l,
      )
    }
  }

  return { view, follow, whole, zoom, barsShown, set, showBars, resumeFollow }
}
