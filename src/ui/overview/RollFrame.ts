/**
 * Where things sit inside a piano-roll canvas, in CSS px (QGOverviewA for the strip, QGOverviewB
 * for the editor). x insets apply to the notes, bars, loop and selection alike.
 */
export interface RollFrame {
  readonly padLeft: number
  readonly padRight: number
  /** Baseline of the bar numbers. */
  readonly numbersY: number
  readonly notesTop: number
  readonly notesBottom: number
  /** Bar lines stop this far inside the notes area (the strip's 6 px). */
  readonly gridInset: number
  /** The loop handles' bar tags: always at this y (the editor), or null = only while dragging. */
  readonly tagY: number | null
  /** The editor's extras: C labels on the left, C lines and beat lines. */
  readonly detail: boolean
  /** A dot on top of the playhead (the strip). */
  readonly playheadDot: boolean
  readonly loopAlpha: number
}
