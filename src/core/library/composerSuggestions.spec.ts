// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { allComposers, composerSuggestions } from './composerSuggestions'

const songs = [
  { composer: 'J. S. Bach' },
  { composer: 'Erik Satie' },
  { composer: 'J. S. Bach' },
  { composer: '' },
  { composer: 'Christian Petzold' },
  { composer: 'erik satie ' },
]

describe('allComposers', () => {
  it('lists each name once, sorted, with song counts; blank composers are skipped', () => {
    expect(allComposers(songs)).toEqual([
      { name: 'Christian Petzold', count: 1 },
      { name: 'erik satie', count: 1 },
      { name: 'Erik Satie', count: 1 },
      { name: 'J. S. Bach', count: 2 },
    ])
  })
})

describe('composerSuggestions', () => {
  const composers = allComposers(songs)

  it('matches substrings case-insensitively', () => {
    const { matches, exactMatch } = composerSuggestions(composers, 'SAT')
    expect(matches.map((c) => c.name)).toEqual(['erik satie', 'Erik Satie'])
    expect(exactMatch).toBe(false)
  })

  it('detects an exact match regardless of case and surrounding spaces', () => {
    expect(composerSuggestions(composers, ' j. s. bach ').exactMatch).toBe(true)
    expect(composerSuggestions(composers, 'Bach').exactMatch).toBe(false)
  })

  it('offers nothing new for an empty query and lists everyone', () => {
    expect(composerSuggestions(composers, '  ')).toEqual({ matches: composers, exactMatch: true })
  })

  it('returns no matches for an unknown name (so it can be added)', () => {
    expect(composerSuggestions(composers, 'Chopin')).toEqual({ matches: [], exactMatch: false })
  })
})
