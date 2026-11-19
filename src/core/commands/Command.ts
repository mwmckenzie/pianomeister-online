import type { Binding } from './Binding'
import type { CommandScope } from './CommandScope'

/** One keyboard command (brief decision 80): what it is, its default keys and where they work. */
export interface Command {
  readonly id: string
  readonly label: string
  /** One line for the cheat sheet. */
  readonly description: string
  /** Up to two default bindings; none means mouse only until the user adds one. */
  readonly keys: readonly Binding[]
  readonly scope: CommandScope
  /** Listed but not rebindable (Esc closes dialogs; it's reserved). */
  readonly fixed?: boolean
}
