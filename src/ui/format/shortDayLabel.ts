/** A day key as an axis label: "21 Oct". */
export function shortDayLabel(key: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(Date.parse(key))
}
