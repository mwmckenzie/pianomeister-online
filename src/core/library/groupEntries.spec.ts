// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { makeEntry } from '../testing/makeEntry'
import { groupEntries } from './groupEntries'

const entries = [
  makeEntry({ title: 'A', composer: 'Bach', tags: ['baroque', 'Exam'] }),
  makeEntry({ title: 'B', composer: '', tags: [] }),
  makeEntry({ title: 'C', composer: 'Bach', tags: ['exam'] }),
  makeEntry({ title: 'D', composer: 'Arne', tags: ['baroque'] }),
]

const shape = (by: 'none' | 'composer' | 'tag') =>
  groupEntries(entries, by).map((g) => [g.label, g.entries.map((e) => e.title)])

describe('groupEntries', () => {
  it('returns one unlabelled group for "none"', () => {
    expect(shape('none')).toEqual([['', ['A', 'B', 'C', 'D']]])
  })

  it('groups by composer with unknown composers last', () => {
    expect(shape('composer')).toEqual([
      ['Arne', ['D']],
      ['Bach', ['A', 'C']],
      ['Unknown composer', ['B']],
    ])
  })

  it('puts songs under every tag, merging case variants, untagged last', () => {
    expect(shape('tag')).toEqual([
      ['baroque', ['A', 'D']],
      ['Exam', ['A', 'C']],
      ['No tags', ['B']],
    ])
  })
})
