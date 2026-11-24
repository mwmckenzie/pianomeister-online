import type { HandNoteSummary } from './HandNoteSummary'

/** Notes per hand and the pitch range of the notes shown, from resolved hands. */
export function summariseHands(
  notes: readonly { readonly midi: number }[],
  hands: string,
): HandNoteSummary {
  let right = 0
  let left = 0
  let lowest = Infinity
  let highest = -Infinity
  notes.forEach((n, i) => {
    if (hands[i] === 'R') right++
    else if (hands[i] === 'L') left++
    else return
    lowest = Math.min(lowest, n.midi)
    highest = Math.max(highest, n.midi)
  })
  const shown = right + left > 0
  return { right, left, lowest: shown ? lowest : null, highest: shown ? highest : null }
}
