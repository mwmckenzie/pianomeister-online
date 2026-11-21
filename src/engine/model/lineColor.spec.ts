// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { lineColor } from './lineColor'

const appearance = { primary: '#8AB4FF', secondary: '#7EE0C3' }

describe('lineColor', () => {
  it('resolves each choice', () => {
    expect(lineColor('white', '#123456', appearance)).toBe('#FFFFFF')
    expect(lineColor('primary', '#123456', appearance)).toBe('#8AB4FF')
    expect(lineColor('secondary', '#123456', appearance)).toBe('#7EE0C3')
    expect(lineColor('custom', '#123456', appearance)).toBe('#123456')
  })
})
