/** Allowed [min, max] for every numeric setting; stored values outside are clamped. */
export const SETTING_RANGES = {
  camera: { tiltDeg: [20, 85], distanceOffset: [-0.6, 1], pan: [-26, 26] },
  highway: { lookAheadBeats: [2, 32], blackLaneShadingStrength: [0, 1] },
  keys: { fadeBeats: [0, 4], maxApproachAlpha: [0, 1] },
  keyboard: {
    thickness: [0.2, 1.2],
    gap: [0, 0.2],
    blackLengthRatio: [0.5, 0.8],
    // Upper bounds of blackHeight and both press depths also depend on other settings:
    // constrainKeyboard() applies those.
    blackHeight: [0, 1.2],
    edgeSize: [0.005, 0.12],
    pressDepthWhite: [0, 1.2],
    pressDepthBlack: [0, 1.12],
    pivotOffsetWhite: [0, 16],
    pivotOffsetBlack: [0, 16],
  },
  notes: {
    sustainCenterTransparency: [0, 1],
    sustainEdgeTransparency: [0, 1],
    headHeight: [0.05, 0.8],
    blackLift: [0, 0.8],
    shadowStrength: [0, 1],
  },
  opacity: { lane: [0, 1], bar: [0, 1], beat: [0, 1], pedal: [0, 1] },
  effects: { minScale: [0.2, 3], maxScale: [0.2, 3] },
  render: { scale: [0.5, 2], maxPixelRatio: [1, 4] },
} as const satisfies Record<string, Record<string, readonly [number, number]>>
