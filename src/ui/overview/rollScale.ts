import type { OverviewView } from '@/core/overview/OverviewView'

import type { RollFrame } from './RollFrame'

/**
 * Ticks ↔ px for a roll of `width` px with its frame's insets: the canvas, its lanes, its
 * action bar and its minimap all place things with the same scale.
 */
export function rollScale(
  view: OverviewView,
  width: number,
  frame: Pick<RollFrame, 'padLeft' | 'padRight'>,
): {
  readonly pxPerTick: number
  readonly x: (tick: number) => number
  readonly tick: (x: number) => number
} {
  const inner = Math.max(1, width - frame.padLeft - frame.padRight)
  const pxPerTick = inner / Math.max(1, view.span)
  return {
    pxPerTick,
    x: (tick) => frame.padLeft + (tick - view.startTick) * pxPerTick,
    tick: (x) => view.startTick + (x - frame.padLeft) / pxPerTick,
  }
}
