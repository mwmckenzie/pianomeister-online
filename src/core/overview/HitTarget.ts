/** Something the pointer can grab in the overview, with its box in px. */
export interface HitTarget {
  readonly kind: 'loopStart' | 'loopEnd' | 'laneItem' | 'laneStart' | 'laneEnd' | 'window'
  /** A lane item's bookmark id. */
  readonly id?: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
