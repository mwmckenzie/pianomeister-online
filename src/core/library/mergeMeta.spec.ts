// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { mergeMeta } from './mergeMeta'

const original = { title: 'Minuet in G', composer: 'Petzold', tags: ['baroque'] }

describe('mergeMeta', () => {
  it('returns the original without an edit', () => {
    expect(mergeMeta(original, null)).toEqual(original)
  })

  it('lets each edited field win, including empty values', () => {
    expect(mergeMeta(original, { title: 'Mine' })).toEqual({ ...original, title: 'Mine' })
    expect(mergeMeta(original, { composer: '', tags: [] })).toEqual({
      title: 'Minuet in G',
      composer: '',
      tags: [],
    })
  })
})
