import type { HandLetter } from './HandLetter'

/** What a voice plays. Hidden: not shown, not heard, no hand. */
export type VoiceRole = 'right' | 'left' | 'split' | 'hidden'

/** Everything that decides a song's hands. */
export interface HandSettings {
  /** By voice id; a voice that isn't listed is Hidden. */
  readonly roles: Readonly<Record<string, VoiceRole>>
  /** Split method id. */
  readonly algorithm: string
  /** Only the values that differ from the method's defaults. */
  readonly params: Readonly<Record<string, number>>
  /** The player's own hand for a note, by note id. */
  readonly flips: Readonly<Record<string, HandLetter>>
}
