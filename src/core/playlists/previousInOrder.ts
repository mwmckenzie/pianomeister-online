import type { PlayOrder } from './PlayOrder'

/** More than this far into a song, Previous restarts it instead of going back (milestone 9.5 C8). */
export const RESTART_AFTER_SEC = 3

/**
 * Previous song: restart the current one when more than 3 s in (or when it's the first),
 * otherwise the one before it in play order.
 */
export function previousInOrder(
  state: PlayOrder,
  secondsIntoSong: number,
): { readonly order: PlayOrder; readonly restart: boolean } {
  if (secondsIntoSong > RESTART_AFTER_SEC || state.position === 0) {
    return { order: state, restart: true }
  }
  return { order: { ...state, position: state.position - 1 }, restart: false }
}
