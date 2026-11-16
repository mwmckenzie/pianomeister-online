// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { normalizeTags } from './normalizeTags'

describe('normalizeTags', () => {
  it('trims, collapses spaces and drops empty tags', () => {
    expect(normalizeTags(['  slow   practice ', '', '   ', 'left\thand'])).toEqual([
      'slow practice',
      'left hand',
    ])
  })

  it('dedupes case-insensitively, keeping the first casing', () => {
    expect(normalizeTags(['Baroque', 'baroque', 'BAROQUE', 'Bach'])).toEqual(['Baroque', 'Bach'])
  })
})
