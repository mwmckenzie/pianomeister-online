/** Linear gains (0–1) for each stage of the output graph. */
export interface OutputGains {
  readonly master: number
  readonly right: number
  readonly left: number
  /** Multiplier for notes that start in a pre-roll: 0 when muted, the quiet level when quiet. */
  readonly preRoll: number
  readonly metronome: number
}
