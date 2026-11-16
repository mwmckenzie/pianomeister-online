/**
 * A key's solid body in world units. Its back edge is at the now line (z = −whiteLength) and it
 * runs `length` toward the player; `top` is the top face's height (white key tops are at 0).
 */
export interface KeyBody {
  readonly midi: number
  readonly isBlack: boolean
  /** Centre of the body, which is also the centre of its lane. */
  readonly centerX: number
  readonly width: number
  readonly length: number
  readonly top: number
  readonly thickness: number
  /** How far the front edge drops when fully pressed. */
  readonly pressDepth: number
  /** Distance of the press pivot behind the back edge (0 = at the back edge). */
  readonly pivotOffset: number
}
