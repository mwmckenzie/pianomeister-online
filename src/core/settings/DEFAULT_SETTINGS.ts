import type { PlayerSettings } from './PlayerSettings'

/** Defaults from docs/brief.md decisions 18–22. */
export const DEFAULT_SETTINGS: PlayerSettings = {
  camera: { tiltDeg: 45, distanceOffset: 0, pan: 0 },
  highway: { lookAheadBeats: 8 },
  keys: { fadeBeats: 1, maxApproachAlpha: 0.7 },
  notes: { sustainCenterTransparency: 0.25, sustainEdgeTransparency: 0.75 },
  colors: {
    background: '#05070F',
    highway: '#0A0F1E',
    lane: '#3A4A6E',
    bar: '#5C6F99',
    beat: '#5C6F99',
    pedal: '#4A5468',
  },
  opacity: { lane: 0.35, bar: 0.6, beat: 0.12, pedal: 0.22 },
  effects: { enabled: true },
}
