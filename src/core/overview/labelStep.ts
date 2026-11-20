/** Room each bar number needs, in px. */
const MIN_LABEL_PX = 24

/**
 * How often bars are numbered: every bar when there's room, else every 2nd, 4th, 8th… (powers
 * of two, so from a step of 4 the numbered bars are the strong ones: 1, 5, 9…).
 */
export function labelStep(pxPerBar: number): number {
  let step = 1
  while (step * pxPerBar < MIN_LABEL_PX && step < 1024) step *= 2
  return step
}
