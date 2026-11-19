import type { Binding } from './Binding'
import type { CommandId } from './CommandId'

/**
 * The user's shortcuts that differ from the defaults (brief decision 88): absent = default keys,
 * an empty list = no key at all.
 */
export type ShortcutOverrides = Readonly<Partial<Record<CommandId, readonly Binding[]>>>
