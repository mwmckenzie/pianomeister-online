/** A time-signature event as it appears in the file, repeats included. */
export interface TimeSignatureEvent {
  readonly tick: number
  readonly numerator: number
  readonly denominator: number
}
