import type { VoiceGuess } from './HandDetection'
import { MIN_VOICE_NOTES } from './MIN_VOICE_NOTES'
import type { VoiceInfo } from './VoiceInfo'

const ROLE_TEXT = {
  right: 'right hand',
  left: 'left hand',
  both: 'both hands',
  drums: 'drums',
} as const

/** A voice's second line: "412 notes · both hands". Only the count until it is detected. */
export function voiceNote(voice: VoiceInfo, guess: VoiceGuess | undefined): string {
  const count = `${voice.noteCount} ${voice.noteCount === 1 ? 'note' : 'notes'}`
  if (guess === undefined) return count
  if (guess.role !== 'other') return `${count} · ${ROLE_TEXT[guess.role]}`
  return `${count} · ${voice.noteCount < MIN_VOICE_NOTES ? 'few notes' : 'other'}`
}
