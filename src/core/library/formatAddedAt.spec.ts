// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { formatAddedAt } from './formatAddedAt'

const now = new Date(2026, 10, 17, 9, 30).getTime()
const at = (month: number, day: number, hour = 12, year = 2026) =>
  new Date(year, month, day, hour).getTime()

describe('formatAddedAt', () => {
  it('shows a dash for bundled songs', () => {
    expect(formatAddedAt(null, now)).toBe('—')
  })

  it('counts calendar days, not 24-hour spans', () => {
    expect(formatAddedAt(at(10, 17, 0), now)).toBe('Today')
    expect(formatAddedAt(at(10, 16, 23), now)).toBe('Yesterday')
    expect(formatAddedAt(at(10, 14), now)).toBe('3 days')
    expect(formatAddedAt(at(10, 11), now)).toBe('6 days')
  })

  it('shows the date after a week, with the year only for other years', () => {
    expect(formatAddedAt(at(10, 10), now)).toBe('10 Nov')
    expect(formatAddedAt(at(0, 2, 12, 2025), now)).toBe('2 Jan 2025')
  })

  it('treats a date in the future (clock change) as today', () => {
    expect(formatAddedAt(at(10, 18), now)).toBe('Today')
  })
})
