/**
 * A function giving the local calendar day ("YYYY-MM-DD") of an instant in `timeZone` (default:
 * the system's). Stats count local calendar days, so a 23- or 25-hour DST day is still one day.
 */
export function dayKeyOf(timeZone?: string): (ms: number) => string {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return (ms) => format.format(ms)
}
