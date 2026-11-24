import { DETECTOR_VERSION } from './DETECTOR_VERSION'
import type { HandSettings } from './HandSettings'

/**
 * A hash of everything a song's resolved hands depend on (the file itself is the song id). The
 * detector version is in it, so a fixed split method drops hands cached with the old one. 53-bit
 * (cyrb53): it only tells one song's settings apart.
 */
export function handsHash(settings: HandSettings): string {
  const sorted = (record: Readonly<Record<string, unknown>>) =>
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1))
  const text = JSON.stringify([
    DETECTOR_VERSION,
    settings.algorithm,
    sorted(settings.params),
    sorted(settings.roles),
    sorted(settings.flips),
  ])
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}
