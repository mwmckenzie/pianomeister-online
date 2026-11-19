// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { loopSeekBar } from './loopSeekBar'

describe('loopSeekBar', () => {
  const loop = { startBar: 20, endBar: 35 }

  it('keeps any bar without a loop', () => {
    expect(loopSeekBar(12, null)).toBe(12)
  })

  it('keeps bars inside the loop, its first and last included', () => {
    expect(loopSeekBar(20, loop)).toBe(20)
    expect(loopSeekBar(27, loop)).toBe(27)
    expect(loopSeekBar(35, loop)).toBe(35)
  })

  it('lands bars before or after the loop on its first bar', () => {
    expect(loopSeekBar(12, loop)).toBe(20)
    expect(loopSeekBar(19, loop)).toBe(20)
    expect(loopSeekBar(36, loop)).toBe(20)
  })
})
