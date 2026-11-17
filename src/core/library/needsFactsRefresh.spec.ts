// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { FACTS_VERSION } from './FACTS_VERSION'
import { needsFactsRefresh } from './needsFactsRefresh'
import type { SongFacts } from './SongFacts'

const facts = (factsVersion?: number): SongFacts => ({
  durationSeconds: 1,
  durationTicks: 480,
  ppq: 480,
  bars: 1,
  timeSignatures: ['4/4'],
  bpm: 120,
  ...(factsVersion === undefined ? {} : { factsVersion }),
})

describe('needsFactsRefresh', () => {
  it('refreshes facts with no version or an older one', () => {
    expect(needsFactsRefresh(facts(), null)).toBe(true)
    expect(needsFactsRefresh(facts(FACTS_VERSION - 1), null)).toBe(true)
  })

  it('leaves current facts alone', () => {
    expect(needsFactsRefresh(facts(FACTS_VERSION), null)).toBe(false)
  })

  it("doesn't retry a file that failed at this version, but does after a bump", () => {
    expect(needsFactsRefresh(facts(), FACTS_VERSION)).toBe(false)
    expect(needsFactsRefresh(facts(), FACTS_VERSION - 1)).toBe(true)
  })
})
