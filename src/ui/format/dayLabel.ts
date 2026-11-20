/** A day key as the charts write it: "Thu 19 Nov". */
export function dayLabel(key: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.parse(key))
}
