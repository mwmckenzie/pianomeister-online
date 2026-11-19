/** The parts of a KeyboardEvent that bindings read (core can't use the DOM type). */
export interface KeyEventLike {
  readonly key: string
  readonly code: string
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
}
