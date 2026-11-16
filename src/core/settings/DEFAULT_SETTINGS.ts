import type { PlayerSettings } from './PlayerSettings'

/** Black key top above the white keys on a grand piano: 12 mm in white-key widths (23.5 mm). */
const GRAND_BLACK_HEIGHT = 12 / 23.5
const BLACK_LENGTH_RATIO = 0.63
/** Visible black key length: 63% of the 150 mm white key, in white-key widths. */
const BLACK_VISIBLE_LENGTH = (BLACK_LENGTH_RATIO * 150) / 23.5

/** Defaults from docs/brief.md decisions 18–22 and 39–48. */
export const DEFAULT_SETTINGS: PlayerSettings = {
  camera: { tiltDeg: 45, distanceOffset: 0, pan: 0 },
  highway: { lookAheadBeats: 8, blackLaneShading: true, blackLaneShadingStrength: 0.22 },
  keys: { fadeBeats: 1, maxApproachAlpha: 0.7 },
  keyboard: {
    thickness: 0.6,
    gap: 0.06,
    blackLengthRatio: BLACK_LENGTH_RATIO,
    blackHeight: GRAND_BLACK_HEIGHT,
    edgeProfile: 'chamfer',
    edgeSize: 0.04,
    animate: true,
    pressDepthWhite: 0.22,
    pressDepthBlack: 0.3,
    pivotOffsetWhite: 0,
    // Twice the visible length behind the key: black keys drop nearly level, slightly tilted.
    pivotOffsetBlack: 2 * BLACK_VISIBLE_LENGTH,
  },
  notes: {
    sustainCenterTransparency: 0.25,
    sustainEdgeTransparency: 0.75,
    heads3d: true,
    headHeight: 0.35,
    headRounded: true,
    blackLiftMode: 'keys',
    blackLift: GRAND_BLACK_HEIGHT,
    contactShadow: true,
    shadowStrength: 0.45,
  },
  colors: {
    background: '#05070F',
    highway: '#0A0F1E',
    lane: '#3A4A6E',
    bar: '#5C6F99',
    beat: '#5C6F99',
    pedal: '#4A5468',
  },
  opacity: { lane: 0.35, bar: 0.6, beat: 0.12, pedal: 0.22 },
  effects: { enabled: true, velocityScaling: true, minScale: 0.6, maxScale: 1.7 },
  render: { scaleAuto: true, scale: 1, maxPixelRatio: 2, antialias: 'msaa' },
}
