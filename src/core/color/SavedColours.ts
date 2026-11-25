/** The copy of a custom set a look carries, used while the set itself is missing. */
export interface SavedColours {
  readonly name: string
  /** Twelve #RRGGBB, index 0 = C. */
  readonly colours: readonly string[]
}
