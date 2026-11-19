import type { Binding } from './Binding'
import type { CommandId } from './CommandId'

/**
 * One change in Settings → Shortcuts (brief decisions 84–86). `set` records a key into chip
 * `index` (index = number of keys adds one); `replace` also takes the key away from the command
 * that had it (the conflict's Replace).
 */
export type ShortcutEdit =
  | {
      readonly type: 'set'
      readonly id: CommandId
      readonly index: number
      readonly binding: Binding
    }
  | {
      readonly type: 'replace'
      readonly id: CommandId
      readonly index: number
      readonly binding: Binding
      readonly from: CommandId
    }
  | { readonly type: 'remove'; readonly id: CommandId; readonly index: number }
  | { readonly type: 'reset'; readonly id: CommandId }
  | { readonly type: 'resetAll' }
