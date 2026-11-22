import type { ComputedRef } from 'vue'

/** A settings section's disabled-control hints: rows report theirs, the section lifts shared ones. */
export interface SectionHints {
  /** A row's current hint (null while enabled or hidden). */
  readonly report: (row: symbol, hint: string | null) => void
  readonly forget: (row: symbol) => void
  /** Hints shown once at the section's top; rows with one of these don't repeat it. */
  readonly shared: ComputedRef<readonly string[]>
}
