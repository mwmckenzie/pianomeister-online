// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { makeEntry } from '../testing/makeEntry'
import { filterEntries } from './filterEntries'

const entries = [
  makeEntry({ title: 'A', tags: ['baroque', 'exam'] }),
  makeEntry({ title: 'B', tags: ['Baroque'], source: 'uploaded' }),
  makeEntry({ title: 'C', tags: [] }),
]

const titles = (tags: string[], source: 'all' | 'bundled' | 'uploaded') =>
  filterEntries(entries, { tags, source }).map((e) => e.title)

describe('filterEntries', () => {
  it('keeps everything without filters', () => {
    expect(titles([], 'all')).toEqual(['A', 'B', 'C'])
  })

  it('needs every selected tag, ignoring case', () => {
    expect(titles(['BAROQUE'], 'all')).toEqual(['A', 'B'])
    expect(titles(['baroque', 'exam'], 'all')).toEqual(['A'])
  })

  it('filters by source', () => {
    expect(titles([], 'uploaded')).toEqual(['B'])
    expect(titles(['baroque'], 'bundled')).toEqual(['A'])
  })
})
