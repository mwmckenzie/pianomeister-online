import type { AudioSettings } from '@/audio/AudioSettings'
import type { PlayerSettings } from '@/core/settings/PlayerSettings'

/** The persisted Audio settings in the shape the scheduler takes (decision 61). */
export function toAudioSettings(audio: PlayerSettings['audio']): AudioSettings {
  return {
    master: audio.master,
    hands: {
      right: { volume: audio.rightVolume, audio: audio.rightAudio },
      left: { volume: audio.leftVolume, audio: audio.leftAudio },
    },
    quietLevel: audio.quietLevel,
    metronome: { mode: audio.metronomeMode, volume: audio.metronomeVolume },
  }
}
