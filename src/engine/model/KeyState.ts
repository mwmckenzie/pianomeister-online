export interface KeyState {
  readonly midi: number
  /** Pitch class 0–11. */
  readonly colorIndex: number
  /** Overlay strength: 1 while sounding, rising toward the max approach alpha before an onset. */
  alpha: number
  sounding: boolean
}
