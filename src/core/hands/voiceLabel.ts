import { gmProgramName } from './gmProgramName'
import type { VoiceInfo } from './VoiceInfo'

/** "Track 1 · ch 0 · Piano": the track's name, else its instrument. */
export function voiceLabel(voice: VoiceInfo): string {
  const name = voice.trackName.trim() || gmProgramName(voice.program, voice.channel)
  return `Track ${voice.track} · ch ${voice.channel} · ${name}`
}
