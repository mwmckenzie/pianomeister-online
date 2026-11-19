import type { LoopRange } from './LoopRange'

/**
 * Where a seek to `bar` lands (brief decision 8): anywhere without a loop; inside the loop as
 * asked; any bar outside an active loop lands on the loop's first bar. So "next bar" on the
 * loop's last bar wraps to its start, and "previous bar" on its first bar stays there.
 */
export function loopSeekBar(bar: number, loop: LoopRange | null): number {
  if (loop === null) return bar
  return bar < loop.startBar || bar > loop.endBar ? loop.startBar : bar
}
