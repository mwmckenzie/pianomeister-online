/** One key in world units. x is the left edge; z runs from 0 (front edge) to −length. */
export interface KeyRect {
  readonly midi: number
  readonly isBlack: boolean
  readonly x: number
  readonly width: number
  readonly length: number
  /** Height of the key top above the white-key tops (0 for white keys). */
  readonly raised: number
}
