/** Where the window of `span` seconds with the most onsets starts (sorted onset seconds). */
export function densestSecond(onsets: readonly number[], span: number): number {
  let best = 0
  let most = 0
  let hi = 0
  for (let lo = 0; lo < onsets.length; lo++) {
    const start = onsets[lo] as number
    while (hi < onsets.length && (onsets[hi] as number) < start + span) hi++
    if (hi - lo > most) {
      most = hi - lo
      best = start
    }
  }
  return best
}
