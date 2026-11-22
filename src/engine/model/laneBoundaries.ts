import { keyLayout } from './keyLayout'

/** What a white-key boundary is drawn as (brief decision 111). */
export type BoundaryKind = 'border' | 'octave' | 'ef' | 'lane'

/**
 * The 53 white-key boundaries (x = 0 … 52) and what each one is: the highway's outer edges,
 * a B/C boundary (an octave line), an E/F boundary, or an ordinary lane line.
 */
export function laneBoundaries(): readonly { readonly x: number; readonly kind: BoundaryKind }[] {
  const whites = keyLayout().filter((k) => !k.isBlack)
  return Array.from({ length: whites.length + 1 }, (_, x) => {
    if (x === 0 || x === whites.length) return { x, kind: 'border' as const }
    const left = (whites[x - 1]?.midi ?? 0) % 12
    if (left === 11) return { x, kind: 'octave' as const }
    if (left === 4) return { x, kind: 'ef' as const }
    return { x, kind: 'lane' as const }
  })
}
