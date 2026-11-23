import type { PlayOrder } from './PlayOrder'
import { shuffled } from './shuffled'

/**
 * The order for a playlist starting at entry `start` (Play: 0, Play on a row: that row).
 * `playable` are the entries whose song exists. Shuffled, `start` plays first and the rest follow
 * in a random order; otherwise the playlist's order from `start`.
 */
export function startOrder(
  playable: readonly number[],
  start: number,
  shuffle: boolean,
  random: () => number,
): PlayOrder {
  const first = playable.includes(start) ? start : (playable.find((i) => i > start) ?? playable[0])
  if (first === undefined) return { order: [], position: 0, shuffle }
  if (!shuffle) return { order: [...playable], position: playable.indexOf(first), shuffle }
  const rest = shuffled(
    playable.filter((i) => i !== first),
    random,
  )
  return { order: [first, ...rest], position: 0, shuffle }
}
