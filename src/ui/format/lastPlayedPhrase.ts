import { formatAddedAt } from '@/core/library/formatAddedAt'

/** "today at 21:40", "yesterday at 21:40", "on 3 Nov at 21:40" (Welcome's resume card). */
export function lastPlayedPhrase(at: number, now: number): string {
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at)
  const day = formatAddedAt(at, now)
  if (day === 'Today' || day === 'Yesterday') return `${day.toLowerCase()} at ${time}`
  if (day.endsWith(' days')) {
    const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(at)
    return `on ${date} at ${time}`
  }
  return `on ${day} at ${time}`
}
