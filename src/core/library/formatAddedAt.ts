const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Midnight (local time) of the day containing `ms`, counted in whole days. */
const dayNumber = (ms: number) => {
  const d = new Date(ms)
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000)
}

/**
 * When an upload was added, as the library's "Added" column shows it, by calendar day in local
 * time: "Today", "Yesterday", "3 days" (up to 6), then "12 Oct", with the year once it isn't
 * this year. Bundled songs have no date: "—".
 */
export function formatAddedAt(addedAt: number | null, now: number): string {
  if (addedAt === null) return '—'
  const days = dayNumber(now) - dayNumber(addedAt)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days`
  const date = new Date(addedAt)
  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()] ?? ''}`
  return date.getFullYear() === new Date(now).getFullYear()
    ? dayMonth
    : `${dayMonth} ${date.getFullYear()}`
}
