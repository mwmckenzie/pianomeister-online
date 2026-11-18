import { formatAddedAt } from '../library/formatAddedAt'

/**
 * "Last" in the stats columns: "Today", "Yesterday", "4 days", "10 Nov"; "—" when never
 * (brief decision 71, the same calendar-day rules as the library's "Added").
 */
export function formatLastPracticed(at: number | null, now: number): string {
  return formatAddedAt(at, now)
}

/** The same in a sentence: "last practiced today", "… 4 days ago", "… 3 Nov", "not practiced yet". */
export function lastPracticedPhrase(at: number | null, now: number): string {
  if (at === null) return 'not practiced yet'
  const text = formatAddedAt(at, now)
  if (text === 'Today' || text === 'Yesterday') return `last practiced ${text.toLowerCase()}`
  if (text.endsWith(' days')) return `last practiced ${text} ago`
  return `last practiced ${text}`
}
