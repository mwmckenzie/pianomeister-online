// @vitest-environment node
import { describe, expect, it } from 'vitest'

import type { HandAudio } from './HandAudio'
import { handGains } from './handGains'

const mix = (right: HandAudio, left: HandAudio, rv = 1, lv = 1) => ({
  right: { volume: rv, audio: right },
  left: { volume: lv, audio: left },
})

describe('handGains', () => {
  it('passes volumes through when both hands are on', () => {
    expect(handGains(mix('on', 'on', 0.8, 0.3))).toEqual({ right: 0.8, left: 0.3 })
  })

  it('silences a muted hand', () => {
    expect(handGains(mix('on', 'muted'))).toEqual({ right: 1, left: 0 })
  })

  it('plays only soloed hands when any hand is soloed', () => {
    expect(handGains(mix('solo', 'on', 0.5))).toEqual({ right: 0.5, left: 0 })
    expect(handGains(mix('solo', 'solo'))).toEqual({ right: 1, left: 1 })
    expect(handGains(mix('muted', 'solo'))).toEqual({ right: 0, left: 1 })
  })

  it('clamps volume to 0–1', () => {
    expect(handGains(mix('on', 'on', 2, -1))).toEqual({ right: 1, left: 0 })
  })
})
