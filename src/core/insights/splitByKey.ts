/** The first instant in (start, end] whose key differs from `start`'s. */
function nextBoundary(start: number, end: number, keyOf: (ms: number) => string): number {
  const startKey = keyOf(start)
  let lo = start
  let hi = end
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    if (keyOf(mid) === startKey) lo = mid
    else hi = mid
  }
  return hi
}

/**
 * Splits the stretch [start, end) into pieces that each fall in one key (a local day, an hour
 * band…), calling `add(key, ms)` for each. Boundaries are found by search, so local-time rules
 * (DST) come from the key function alone.
 */
export function splitByKey(
  start: number,
  end: number,
  keyOf: (ms: number) => string,
  add: (key: string, ms: number) => void,
): void {
  let at = start
  while (at < end) {
    const key = keyOf(at)
    const boundary = keyOf(end - 1) === key ? end : nextBoundary(at, end, keyOf)
    add(key, boundary - at)
    at = boundary
  }
}
