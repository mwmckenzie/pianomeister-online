/**
 * Player view settings, persisted in localStorage until profiles arrive (milestone 7).
 * Colors are #rrggbb; opacities, transparencies and strengths are 0–1; lengths are world units
 * (1 = one white-key width).
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
    /** Black-key lanes darker than white-key lanes. */
    readonly blackLaneShading: boolean
    readonly blackLaneShadingStrength: number
  }
  readonly keys: {
    /** Fade-in window before an onset, in quarter notes. */
    readonly fadeBeats: number
    readonly maxApproachAlpha: number
  }
  readonly keyboard: {
    /** Height of the key bodies (white and black). */
    readonly thickness: number
    /** Space between neighbouring white keys (key bodies shrink; lanes never move). */
    readonly gap: number
    /** Black key length as a fraction of the white key length. */
    readonly blackLengthRatio: number
    /**
     * Black key top above the white key tops. At most the key thickness, so a black key's body
     * always reaches down to the white keys (see constrainKeyboard).
     */
    readonly blackHeight: number
    readonly edgeProfile: 'none' | 'chamfer' | 'rounded'
    readonly edgeSize: number
    /** Keys pivot down while their note sounds. */
    readonly animate: boolean
    /** How far the front edge of a pressed white key drops. At most the key thickness. */
    readonly pressDepthWhite: number
    /**
     * How far the front edge of a pressed black key drops. At most blackHeight − 0.08, so a
     * pressed black key's top stays above the white key tops.
     */
    readonly pressDepthBlack: number
    /**
     * Distance of the pivot behind each key's visible back edge (0 = at the back edge). Real keys
     * pivot far behind (the balance rail), so they mostly drop with only a slight tilt.
     */
    readonly pivotOffsetWhite: number
    readonly pivotOffsetBlack: number
  }
  readonly notes: {
    readonly sustainCenterTransparency: number
    readonly sustainEdgeTransparency: number
    /** Heads as raised blocks instead of flat strips. */
    readonly heads3d: boolean
    readonly headHeight: number
    readonly headRounded: boolean
    /** 'keys' = lift black-lane notes to the black key tops; 'manual' = use blackLift. */
    readonly blackLiftMode: 'keys' | 'manual'
    readonly blackLift: number
    readonly contactShadow: boolean
    readonly shadowStrength: number
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
    /** Spark and glow size follow note velocity (else uniform size). */
    readonly velocityScaling: boolean
    /** Size factor at velocity 0 and at velocity 127. */
    readonly minScale: number
    readonly maxScale: number
  }
  readonly render: {
    /** Render at the device pixel ratio; otherwise at `scale` × CSS pixels. */
    readonly scaleAuto: boolean
    readonly scale: number
    /** Upper bound for the resulting pixel ratio. */
    readonly maxPixelRatio: number
    readonly antialias: 'off' | 'msaa' | 'fxaa' | 'smaa'
  }
}
