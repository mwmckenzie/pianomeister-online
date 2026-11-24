import type { VoiceGuess } from '@/core/hands/HandDetection'
import type { HandSettings } from '@/core/hands/HandSettings'
import type { SongHands } from '@/core/hands/SongHands'
import type { VoiceInfo } from '@/core/hands/VoiceInfo'

/** A song's hands in full, for the Library's details and the Review page. */
export interface HandDetails {
  readonly hands: SongHands
  readonly voices: readonly VoiceInfo[]
  /** The settings in effect. */
  readonly settings: HandSettings
  /** The settings detection gave; null until the song is detected. */
  readonly detected: HandSettings | null
  /** Detection's guesses, by voice order; empty until the song is detected. */
  readonly guesses: readonly VoiceGuess[]
}
