// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatLastPracticed, lastPracticedPhrase } from './formatLastPracticed'

const now = new Date(2026, 10, 18, 15, 0).getTime()
const daysAgo = (n: number) => new Date(2026, 10, 18 - n, 9, 0).getTime()

describe('last practiced', () => {
  it('reads like the library dates', () => {
    expect(formatLastPracticed(daysAgo(0), now)).toBe('Today')
    expect(formatLastPracticed(daysAgo(1), now)).toBe('Yesterday')
    expect(formatLastPracticed(daysAgo(4), now)).toBe('4 days')
    expect(formatLastPracticed(daysAgo(8), now)).toBe('10 Nov')
    expect(formatLastPracticed(null, now)).toBe('—')
  })

  it('reads in a sentence', () => {
    expect(lastPracticedPhrase(daysAgo(0), now)).toBe('last practiced today')
    expect(lastPracticedPhrase(daysAgo(1), now)).toBe('last practiced yesterday')
    expect(lastPracticedPhrase(daysAgo(4), now)).toBe('last practiced 4 days ago')
    expect(lastPracticedPhrase(daysAgo(15), now)).toBe('last practiced 3 Nov')
    expect(lastPracticedPhrase(null, now)).toBe('not practiced yet')
  })
})
