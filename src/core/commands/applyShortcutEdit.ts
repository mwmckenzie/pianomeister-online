import type { Binding } from './Binding'
import type { CommandId } from './CommandId'
import { sameBinding } from './keyBindings'
import { commandById, effectiveBindings } from './shortcutBindings'
import type { ShortcutEdit } from './ShortcutEdit'
import type { ShortcutOverrides } from './ShortcutOverrides'

/** At most two keys per command (brief decision 84). */
export const MAX_KEYS = 2

/**
 * Applies one edit and returns the new overrides plus the previous ones (for Undo). A command
 * whose keys end up equal to its defaults loses its override, so "changed" always means
 * "differs from the default". Fixed commands can't be edited.
 */
export function applyShortcutEdit(
  overrides: ShortcutOverrides,
  edit: ShortcutEdit,
): { readonly overrides: ShortcutOverrides; readonly previous: ShortcutOverrides } {
  const previous = overrides
  if (edit.type === 'resetAll') return { overrides: {}, previous }
  const next: Partial<Record<CommandId, readonly Binding[]>> = { ...overrides }
  const current = effectiveBindings(overrides)

  const put = (id: CommandId, keys: readonly Binding[]): void => {
    const command = commandById(id)
    if (command.fixed === true) return
    const unique = keys.filter((k, i) => keys.findIndex((o) => sameBinding(o, k)) === i)
    const kept = unique.slice(0, MAX_KEYS)
    const isDefault =
      kept.length === command.keys.length &&
      kept.every((k, i) => sameBinding(k, command.keys[i] as Binding))
    if (isDefault) delete next[id]
    else next[id] = kept
  }

  switch (edit.type) {
    case 'reset':
      delete next[edit.id]
      break
    case 'remove': {
      const keys = [...(current.get(edit.id) ?? [])]
      keys.splice(edit.index, 1)
      put(edit.id, keys)
      break
    }
    case 'replace': {
      const theirs = (current.get(edit.from) ?? []).filter((k) => !sameBinding(k, edit.binding))
      put(edit.from, theirs)
    }
    // falls through: then set the key here
    case 'set': {
      const keys = [...(current.get(edit.id) ?? [])]
      keys[Math.min(edit.index, keys.length)] = edit.binding
      put(edit.id, keys)
      break
    }
  }
  return { overrides: next, previous }
}
