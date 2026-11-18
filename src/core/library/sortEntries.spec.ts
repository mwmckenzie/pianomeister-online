// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { makeEntry } from '../testing/makeEntry'
import { sortEntries } from './sortEntries'

const facts = (durationSeconds: number) => ({
  durationSeconds,
  durationTicks: 1,
  ppq: 480,
  bars: 1,
  timeSignatures: ['4/4'],
  bpm: 120,
})

const entries = [
  makeEntry({ title: 'Étude 10', composer: 'Chopin', facts: facts(120) }),
  makeEntry({
    title: 'etude 9',
    composer: '',
    source: 'uploaded',
    addedAt: 2000,
    facts: facts(30),
  }),
  makeEntry({
    title: 'Air',
    composer: 'bach',
    source: 'uploaded',
    addedAt: 1000,
    facts: facts(60),
  }),
  makeEntry({ title: 'Canon', composer: 'Pachelbel', facts: facts(240) }),
]

const titles = (field: Parameters<typeof sortEntries>[1], direction: 'asc' | 'desc') =>
  sortEntries(entries, field, direction).map((e) => e.title)

describe('sortEntries', () => {
  it('sorts titles ignoring case and accents, with numeric order', () => {
    expect(titles('title', 'asc')).toEqual(['Air', 'Canon', 'etude 9', 'Étude 10'])
    expect(titles('title', 'desc')).toEqual(['Étude 10', 'etude 9', 'Canon', 'Air'])
  })

  it('sorts by composer and keeps unknown composers last', () => {
    expect(titles('composer', 'asc')).toEqual(['Air', 'Étude 10', 'Canon', 'etude 9'])
    expect(titles('composer', 'desc')).toEqual(['Canon', 'Étude 10', 'Air', 'etude 9'])
  })

  it('sorts by duration', () => {
    expect(titles('duration', 'asc')).toEqual(['etude 9', 'Air', 'Étude 10', 'Canon'])
  })

  it('sorts by bar count as shown (override applied), ties by title', () => {
    const withBars = entries.map((e, i) => ({ ...e, bars: [16, 64, 16, 8][i] ?? 0 }))
    expect(sortEntries(withBars, 'bars', 'asc').map((e) => e.title)).toEqual([
      'Canon',
      'Air',
      'Étude 10',
      'etude 9',
    ])
  })

  it('sorts by date added with bundled songs oldest, ties by title', () => {
    expect(titles('dateAdded', 'desc')).toEqual(['etude 9', 'Air', 'Canon', 'Étude 10'])
  })

  it('sorts by source, bundled first, then title', () => {
    expect(titles('source', 'asc')).toEqual(['Canon', 'Étude 10', 'Air', 'etude 9'])
  })
  it('sorts by a practice column with songs that have none last, in both directions', () => {
    const practice = new Map([
      ['Air', { plays: 3, playedMs: 60_000, lastPlayedAt: 500, bookmarks: 2 }],
      ['Canon', { plays: 9, playedMs: 30_000, lastPlayedAt: 900, bookmarks: 0 }],
      ['etude 9', { plays: 0, playedMs: 0, lastPlayedAt: null, bookmarks: 0 }],
    ])
    const by = (field: 'plays' | 'time' | 'last' | 'bookmarks', direction: 'asc' | 'desc') =>
      sortEntries(entries, field, direction, practice).map((e) => e.title)
    expect(by('plays', 'desc')).toEqual(['Canon', 'Air', 'etude 9', 'Étude 10'])
    expect(by('plays', 'asc')).toEqual(['Air', 'Canon', 'etude 9', 'Étude 10'])
    expect(by('time', 'desc')).toEqual(['Air', 'Canon', 'etude 9', 'Étude 10'])
    expect(by('last', 'desc')).toEqual(['Canon', 'Air', 'etude 9', 'Étude 10'])
    expect(by('bookmarks', 'desc')).toEqual(['Air', 'Canon', 'etude 9', 'Étude 10'])
  })
})
