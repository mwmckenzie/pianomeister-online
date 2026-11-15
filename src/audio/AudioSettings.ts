import type { HandMix } from '@/core/practice/HandMix'

import type { MetronomeMode } from './MetronomeMode'

export interface AudioSettings {
  /** 0–1. */
  readonly master: number
  readonly hands: HandMix
  /** Gain for pre-roll notes in 'quiet' mode, 0–1 (default 0.25). */
  readonly quietLevel: number
  readonly metronome: { readonly mode: MetronomeMode; readonly volume: number }
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 0.8,
  hands: { right: { volume: 1, audio: 'on' }, left: { volume: 1, audio: 'on' } },
  quietLevel: 0.25,
  metronome: { mode: 'off', volume: 0.6 },
}
