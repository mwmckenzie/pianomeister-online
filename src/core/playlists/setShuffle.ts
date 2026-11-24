import type { PlayOrder } from './PlayOrder'
import { shuffled } from './shuffled'

/**
 * Shuffle switched on or off mid-playlist: the current song stays where it is (first of a new
 * shuffled order, or at its place in the playlist's order).
 */
export function setShuffle(
  state: PlayOrder,
  playable: readonly number[],
  shuffle: boolean,
  random: () => number,
): PlayOrder {
  const current = state.order[state.position]
  if (current === undefined) return { ...state, shuffle }
  if (!shuffle)
    return { order: [...playable], position: Math.max(0, playable.indexOf(current)), shuffle }
  const rest = shuffled(
    playable.filter((i) => i !== current),
    random,
  )
  return { order: [current, ...rest], position: 0, shuffle }
}
