import type { PlayerSettings } from '../settings/PlayerSettings'
import type { LoopRange } from '../transport/LoopRange'
import type { PracticeConfig } from './PracticeConfig'

/**
 * What "Full song" plays (brief decision 68): the whole song at 100%, with the hand modes,
 * pre-roll and metronome mode from the device-wide settings.
 */
export function fullSongConfig(settings: PlayerSettings): PracticeConfig {
  return {
    loop: null,
    tempoPercent: 100,
    handAudio: { right: settings.audio.rightAudio, left: settings.audio.leftAudio },
    preRollBeats: settings.practice.preRollBeats,
    preRollMode: settings.practice.preRollMode,
    metronomeMode: settings.audio.metronomeMode,
  }
}

/**
 * What a bookmark's fields reset to in the manager: bars 1–4 (fewer if the song is shorter),
 * 100%, both hands, the pre-roll from the settings, no metronome.
 */
export function newBookmarkConfig(
  settings: PlayerSettings,
  lastBar: number,
): PracticeConfig & { readonly loop: LoopRange } {
  return {
    loop: { startBar: 1, endBar: Math.max(1, Math.min(4, lastBar)) },
    tempoPercent: 100,
    handAudio: { right: 'on', left: 'on' },
    preRollBeats: settings.practice.preRollBeats,
    preRollMode: settings.practice.preRollMode,
    metronomeMode: 'off',
  }
}
