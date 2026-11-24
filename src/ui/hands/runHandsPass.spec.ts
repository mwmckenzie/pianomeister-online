import { describe, expect, it, vi } from 'vitest'

import { handsPassMessage } from '@/core/hands/handsPassMessage'

import { runHandsPass } from './runHandsPass'

const idle = async () => undefined

describe('runHandsPass', () => {
  it('detects one song at a time, waiting for idle and for playback to stop', async () => {
    const log: string[] = []
    let playing = 2
    const detected = await runHandsPass({
      songIds: ['a', 'b'],
      isPlaying: () => playing > 0,
      idle: async () => void log.push('idle'),
      wait: async () => {
        playing--
        log.push('wait')
      },
      detect: async (id) => {
        log.push(id)
        return true
      },
    })
    expect(log).toEqual(['idle', 'wait', 'wait', 'a', 'idle', 'b'])
    expect(detected).toEqual(['a', 'b'])
  })

  it('goes on after a failure, and leaves out songs that are gone', async () => {
    const onFailed = vi.fn<(id: string, e: unknown) => void>()
    const detected = await runHandsPass({
      songIds: ['bad', 'gone', 'ok'],
      isPlaying: () => false,
      idle,
      wait: idle,
      detect: async (id) => {
        if (id === 'bad') throw new Error('x')
        return id === 'ok'
      },
      onFailed,
    })
    expect(detected).toEqual(['ok'])
    expect(onFailed.mock.calls.map(([id]) => id)).toEqual(['bad'])
  })

  it('says what it did, and nothing when it did nothing', () => {
    expect(handsPassMessage(0, 0)).toBeNull()
    expect(handsPassMessage(1, 0)).toBe('Hands detected for 1 song · 0 to check')
    expect(handsPassMessage(5, 2)).toBe('Hands detected for 5 songs · 2 to check')
  })
})
