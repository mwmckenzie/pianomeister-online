import type { LoopWindow } from './LoopWindow'

/** At most this many repeats are drawn, however short the loop (a guard, not a design limit). */
export const MAX_LOOP_REPEATS = 48

/**
 * How many repeats of the loop the highway needs beyond its end ("After the loop end: Next
 * repeat", milestone 9.2) with the playhead at `tick` and `visibleTicks` of highway ahead of
 * it. None while the playhead is outside the iteration (before the count-in or past the end):
 * then the song shows as it is.
 */
export function loopRepeatCount(window: LoopWindow, tick: number, visibleTicks: number): number {
  if (!repeatActive(window, tick)) return 0
  const beyond = tick + visibleTicks - window.endTick
  if (beyond <= 0) return 0
  return Math.min(MAX_LOOP_REPEATS, Math.ceil(beyond / window.periodTicks))
}

/** The repeat shows only while the playhead is inside the iteration (count-in included). */
export function repeatActive(window: LoopWindow, tick: number): boolean {
  return window.periodTicks > 0 && tick >= window.preStartTick && tick < window.endTick
}

/**
 * The song tick shown at highway tick `tick` while the repeat is on: beyond the loop end each
 * period shows the iteration again (the shaders' loopSongTick does the same for static
 * surfaces like the lanes).
 */
export function loopSongTick(window: LoopWindow, tick: number): number {
  if (tick < window.endTick || window.periodTicks <= 0) return tick
  const k = Math.floor((tick - window.endTick) / window.periodTicks) + 1
  return tick - k * window.periodTicks
}

/** Whether a song tick is outside the practice section (dimmed while Dim outside is on). */
export function outsideLoop(window: LoopWindow, songTick: number): boolean {
  return songTick < window.startTick || songTick >= window.endTick
}
