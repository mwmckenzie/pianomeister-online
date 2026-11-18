/**
 * A play count: a bare "9" in narrow columns, "9 plays" / "1 play" where there's room; "—"
 * when there are none.
 */
export function formatPlays(plays: number, withUnit = false): string {
  if (plays <= 0) return '—'
  if (!withUnit) return String(plays)
  return plays === 1 ? '1 play' : `${plays} plays`
}

/** "Played" in the stats blocks: "23×", or "—". */
export function formatPlayedTimes(plays: number): string {
  return plays > 0 ? `${plays}×` : '—'
}

/** An entry's share of its song's practice time: "42%", or "—" when unknown. */
export function formatShare(share: number | null): string {
  return share === null ? '—' : `${Math.round(share * 100)}%`
}
