/**
 * A day's shade in the practice calendars (m7-7 decisions 8 and 18): fixed minute thresholds, so
 * a shade means the same in every range and profile. 0 = none, 1 = 1–14, 2 = 15–29, 3 = 30–44,
 * 4 = 45 minutes or more.
 */
export function heatmapLevel(ms: number): 0 | 1 | 2 | 3 | 4 {
  const minutes = ms / 60_000
  if (minutes < 0.5) return 0
  if (minutes < 15) return 1
  if (minutes < 30) return 2
  if (minutes < 45) return 3
  return 4
}
