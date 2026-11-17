// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { DEFAULT_AUDIO_SETTINGS } from '@/audio/AudioSettings'
import { DEFAULT_SETTINGS } from '@/core/settings/DEFAULT_SETTINGS'

import { toAudioSettings } from './toAudioSettings'

describe('toAudioSettings', () => {
  it('maps the settings defaults to the scheduler defaults', () => {
    expect(toAudioSettings(DEFAULT_SETTINGS.audio)).toEqual(DEFAULT_AUDIO_SETTINGS)
  })

  it('maps per-hand volume and on/mute/solo and the metronome', () => {
    const audio = {
      ...DEFAULT_SETTINGS.audio,
      leftVolume: 0.6,
      rightAudio: 'solo' as const,
      metronomeMode: 'always' as const,
      metronomeVolume: 0.3,
    }
    expect(toAudioSettings(audio)).toMatchObject({
      hands: { right: { volume: 1, audio: 'solo' }, left: { volume: 0.6, audio: 'on' } },
      metronome: { mode: 'always', volume: 0.3 },
    })
  })
})
