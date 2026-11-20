/**
 * A practice time split for a large number with a small unit (QGWelcomeA "3 h 14 min",
 * QGStats "9 h 12 min"): `{ value: '3 h 14', unit: 'min' }`, `{ value: '27', unit: 'min' }`,
 * `{ value: '2', unit: 'h' }`; "0 min" for none.
 */
export function bigDuration(ms: number): { readonly value: string; readonly unit: string } {
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  if (minutes < 60) return { value: String(minutes), unit: 'min' }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0
    ? { value: String(hours), unit: 'h' }
    : { value: `${hours} h ${rest}`, unit: 'min' }
}
