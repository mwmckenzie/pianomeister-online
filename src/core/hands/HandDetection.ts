/** What detection thinks a voice is ('both' = both hands, to be split). */
export type DetectedRole = 'right' | 'left' | 'both' | 'other' | 'drums'

export interface VoiceGuess {
  readonly voiceId: string
  readonly role: DetectedRole
  /** 0–1: a hand-tuned score, not a probability. */
  readonly confidence: number
  readonly reasons: readonly string[]
}

export interface HandDetection {
  /** One per voice, in the stats' order. */
  readonly guesses: readonly VoiceGuess[]
  readonly right: string | null
  readonly left: string | null
  /** Voices that look two-handed. */
  readonly combined: readonly string[]
  /** The right and left voices that were chosen by their track's name. */
  readonly named: readonly string[]
  readonly summary: string
}
