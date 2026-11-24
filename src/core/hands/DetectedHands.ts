import type { CachedHands } from './CachedHands'
import type { VoiceGuess } from './HandDetection'
import type { HandSettings } from './HandSettings'
import type { VoiceInfo } from './VoiceInfo'

/** Everything detection found in one file, with the hands it gives. */
export interface DetectedHands {
  readonly detectorVersion: number
  readonly voices: readonly VoiceInfo[]
  readonly guesses: readonly VoiceGuess[]
  readonly summary: string
  readonly settings: HandSettings
  /** 0–1 (songConfidence); null when no voice is shown. */
  readonly confidence: number | null
  readonly resolved: CachedHands
}
