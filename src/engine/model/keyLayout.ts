import { isBlackKey } from './isBlackKey'
import { KEYBOARD } from './KEYBOARD'
import type { KeyRect } from './KeyRect'

let cached: readonly KeyRect[] | null = null

/**
 * The 88 keys (MIDI 21–108) at grand-piano proportions. White keys sit side by side from
 * x = 0; each black key is centred on the boundary between its two white neighbours.
 */
export function keyLayout(): readonly KeyRect[] {
  if (cached !== null) return cached
  const keys: KeyRect[] = []
  let whiteIndex = 0
  for (let midi = KEYBOARD.lowest; midi <= KEYBOARD.highest; midi++) {
    if (isBlackKey(midi)) {
      // The boundary is the left edge of the next white key, i.e. x = whiteIndex.
      keys.push({
        midi,
        isBlack: true,
        x: whiteIndex - KEYBOARD.blackWidth / 2,
        width: KEYBOARD.blackWidth,
        length: KEYBOARD.blackLength,
        raised: KEYBOARD.blackRaise,
      })
    } else {
      keys.push({
        midi,
        isBlack: false,
        x: whiteIndex,
        width: KEYBOARD.whiteWidth,
        length: KEYBOARD.whiteLength,
        raised: 0,
      })
      whiteIndex++
    }
  }
  cached = keys
  return keys
}
