// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { makeEntry } from '../testing/makeEntry'
import { matchesSearch } from './matchesSearch'

const entry = makeEntry({
  title: 'Humoresque',
  composer: 'Antonín Dvořák',
  tags: ['Romantic', 'left hand'],
})

describe('matchesSearch', () => {
  it('matches everything for an empty query', () => {
    expect(matchesSearch(entry, '   ')).toBe(true)
  })

  it('ignores case and diacritics', () => {
    expect(matchesSearch(entry, 'DVORAK')).toBe(true)
    expect(matchesSearch(entry, 'antonin')).toBe(true)
    expect(matchesSearch(entry, 'humor')).toBe(true)
  })

  it('searches tags and needs every word', () => {
    expect(matchesSearch(entry, 'romantic dvorak')).toBe(true)
    expect(matchesSearch(entry, 'left hand')).toBe(true)
    expect(matchesSearch(entry, 'romantic bach')).toBe(false)
  })
})
