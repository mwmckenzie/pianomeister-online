/**
 * Where a loop sits on the highway, in song ticks (milestone 9.2): the practice section
 * [startTick, endTick), the count-in before it from preStartTick, and the period of one
 * iteration as the playhead sees it (endTick − preStartTick: exactly the jump at each wrap).
 */
export interface LoopWindow {
  readonly startTick: number
  readonly endTick: number
  /** Where each iteration starts: the pre-roll's start, or startTick without pre-roll. */
  readonly preStartTick: number
  readonly periodTicks: number
}
