import type { CommandScope } from './CommandScope'

/** One keyboard command (brief decision 80): what it is, its default keys and where they work. */
export interface Command {
  readonly id: string
  readonly label: string
  /** KeyboardEvent.code values (layout-independent: `KeyB` is the key labelled B on QWERTY). */
  readonly keys: readonly string[]
  readonly scope: CommandScope
}
