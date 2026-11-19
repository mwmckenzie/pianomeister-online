import { onBeforeUnmount, shallowRef, type ShallowRef } from 'vue'

import { nudgeLoop } from '@/core/practice/nudgeLoop'
import type { LoopRange } from '@/core/transport/LoopRange'

import { KEY_SETTLE_MS } from '../input/KEY_SETTLE_MS'

/**
 * Loop nudges (brief decision 92): each nudge moves one end of the loop by a bar and shows the
 * new range at once (`pending`); the range applies, turning the loop on and jumping to its start,
 * once nudging pauses for KEY_SETTLE_MS, so a run of nudges is one jump. With the loop off,
 * nudges start from the last range.
 */
export function useLoopNudge(options: {
  /** The loop that's on, else the range the loop button turns on. */
  readonly base: () => LoopRange
  readonly firstBar: () => number
  readonly lastBar: () => number
  readonly apply: (range: LoopRange) => void
}): {
  readonly pending: Readonly<ShallowRef<LoopRange | null>>
  nudge: (edge: 'start' | 'end', bars: number) => void
  cancel: () => void
} {
  const pending = shallowRef<LoopRange | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function settle(): void {
    timer = undefined
    const range = pending.value
    pending.value = null
    if (range !== null) options.apply(range)
  }

  function nudge(edge: 'start' | 'end', bars: number): void {
    const from = pending.value ?? options.base()
    const next = nudgeLoop(
      { start: from.startBar, end: from.endBar },
      edge,
      bars,
      options.firstBar(),
      options.lastBar(),
    )
    pending.value = { startBar: next.start, endBar: next.end }
    clearTimeout(timer)
    timer = setTimeout(settle, KEY_SETTLE_MS)
  }

  /** Another change to the loop wins over nudges still waiting. */
  function cancel(): void {
    clearTimeout(timer)
    timer = undefined
    pending.value = null
  }

  onBeforeUnmount(() => clearTimeout(timer))
  return { pending, nudge, cancel }
}
