// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { sharedHints } from './sharedHints'

describe('sharedHints', () => {
  it('lifts a hint that three or more rows share', () => {
    expect(sharedHints(['A', null, 'A', 'A'])).toEqual(['A'])
  })

  it('keeps hints that fewer rows share on the rows', () => {
    expect(sharedHints(['A', 'A', 'B', null])).toEqual([])
  })

  it('handles several reasons in one section, in first-seen order', () => {
    expect(sharedHints(['B', 'A', 'B', 'A', 'B', 'A', 'C'])).toEqual(['B', 'A'])
  })

  it('has nothing to lift when every row is enabled', () => {
    expect(sharedHints([null, null, null])).toEqual([])
  })
})
