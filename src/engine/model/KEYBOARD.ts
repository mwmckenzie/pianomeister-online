/** Grand-piano key dimensions in world units (1 unit = one white-key width = 23.5 mm). */
const MM = 1 / 23.5

export const KEYBOARD = {
  whiteWidth: 1,
  whiteLength: 150 * MM,
  blackWidth: 13.7 * MM,
  blackLength: 95 * MM,
  /** Height of a black key's top above the white keys' tops. */
  blackRaise: 12 * MM,
  whiteCount: 52,
  /** Total width: 52 white keys, A0 at x = 0. */
  width: 52,
  lowest: 21,
  highest: 108,
} as const
