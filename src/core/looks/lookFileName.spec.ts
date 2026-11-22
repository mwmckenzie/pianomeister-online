// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { lookFileName } from './lookFileName'

describe('lookFileName', () => {
  it('names the file after the look, safely', () => {
    expect(lookFileName('Night Focus')).toBe('Night Focus.pmlook.json')
    expect(lookFileName('A/B: "C"?')).toBe('A-B- -C--.pmlook.json')
    expect(lookFileName('  ')).toBe('look.pmlook.json')
  })
})
