/**
 * Player view settings, persisted in localStorage until profiles arrive (milestone 5).
 * Colors are #rrggbb; opacities and transparencies are 0–1.
 */
export interface PlayerSettings {
  readonly camera: {
    readonly tiltDeg: number
    /** 0 = the keyboard exactly fills the width; positive = farther, negative = closer (crops). */
    readonly distanceOffset: number
    /** Sideways shift in white-key widths. */
    readonly pan: number
  }
  readonly highway: {
    /** Quarter notes from the now line to the 1x look-ahead point (the haze runs to 1.5x). */
    readonly lookAheadBeats: number
  }
  readonly keys: {
    /** Fade-in window before an onset, in quarter notes. */
    readonly fadeBeats: number
    readonly maxApproachAlpha: number
  }
  readonly notes: {
    readonly sustainCenterTransparency: number
    readonly sustainEdgeTransparency: number
  }
  readonly colors: {
    readonly background: string
    readonly highway: string
    readonly lane: string
    readonly bar: string
    readonly beat: string
    readonly pedal: string
  }
  readonly opacity: {
    readonly lane: number
    readonly bar: number
    readonly beat: number
    readonly pedal: number
  }
  readonly effects: {
    readonly enabled: boolean
  }
}
