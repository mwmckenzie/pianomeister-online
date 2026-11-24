import type { PlaylistRepeat } from './PlaylistRepeat'
import type { PlayOrder } from './PlayOrder'
import { shuffled } from './shuffled'

/**
 * What plays after the current song (milestone 9.5 C10), or null when the playlist is finished
 * (repeat off, after the last). Repeat one: the same song. Repeat playlist: wraps to the start;
 * shuffled, a fresh order whose first song isn't the one that just played (when there's another).
 */
export function nextInOrder(
  state: PlayOrder,
  repeat: PlaylistRepeat,
  random: () => number,
): PlayOrder | null {
  if (state.order.length === 0) return null
  if (repeat === 'one') return state
  if (state.position + 1 < state.order.length) return { ...state, position: state.position + 1 }
  if (repeat === 'off') return null
  if (!state.shuffle) return { ...state, position: 0 }
  const last = state.order[state.position]
  let order = shuffled(state.order, random)
  if (order.length > 1 && order[0] === last) order = [...order.slice(1), order[0] as number]
  return { order, position: 0, shuffle: true }
}
