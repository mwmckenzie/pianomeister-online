/** Allowed [min, max] for every numeric setting; stored values outside are clamped. */
export const SETTING_RANGES = {
  camera: { tiltDeg: [20, 85], distanceOffset: [-0.6, 1], pan: [-26, 26] },
  highway: { lookAheadBeats: [2, 32] },
  keys: { fadeBeats: [0, 4], maxApproachAlpha: [0, 1] },
  notes: { sustainCenterTransparency: [0, 1], sustainEdgeTransparency: [0, 1] },
  opacity: { lane: [0, 1], bar: [0, 1], beat: [0, 1], pedal: [0, 1] },
} as const satisfies Record<string, Record<string, readonly [number, number]>>
