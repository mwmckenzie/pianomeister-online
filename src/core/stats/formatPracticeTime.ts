/** Practice time as the stats show it: "14 min", "1 h 5 min", "2 h", "<1 min"; "—" for none. */
export function formatPracticeTime(ms: number): string {
  if (!(ms > 0)) return '—'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return '<1 min'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
