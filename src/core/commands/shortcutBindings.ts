import type { Binding } from './Binding'
import type { Command } from './Command'
import type { CommandId } from './CommandId'
import type { CommandScope } from './CommandScope'
import { COMMANDS } from './COMMANDS'
import { matchesAltGrCharacter, matchesEvent, sameBinding } from './keyBindings'
import type { KeyEventLike } from './KeyEventLike'
import type { ShortcutOverrides } from './ShortcutOverrides'

/** Every command with its keys in effect: the user's override, or the default. */
export type EffectiveBindings = ReadonlyMap<CommandId, readonly Binding[]>

export function commandById(id: CommandId): Command {
  const command = COMMANDS.find((c) => c.id === id)
  if (command === undefined) throw new Error(`Unknown command ${id}`)
  return command
}

/** The keys each command answers to; fixed commands ignore overrides. */
export function effectiveBindings(overrides: ShortcutOverrides): EffectiveBindings {
  return new Map(
    COMMANDS.map((c): [CommandId, readonly Binding[]] => {
      const fixed = 'fixed' in c && c.fixed
      return [c.id, fixed ? c.keys : (overrides[c.id] ?? c.keys)]
    }),
  )
}

/**
 * Two scopes compete for the same keys (decision 86): equal scopes do; lists and tabs run on the
 * same pages; player runs with neither; dialogs run on top of everything and app keys work on
 * every page, so those conflict with everything.
 */
export function scopesConflict(a: CommandScope, b: CommandScope): boolean {
  if (a === b) return true
  // Listening replaces the player; an open dialog takes keys (Esc) before listening does.
  const pair = new Set([a, b])
  if (pair.has('listening') && (pair.has('player') || pair.has('dialogs'))) return false
  if (a === 'dialogs' || b === 'dialogs' || a === 'app' || b === 'app') return true
  return (a === 'lists' && b === 'tabs') || (a === 'tabs' && b === 'lists')
}

/** The commands (other than `except`) that already use this key where `scope`'s keys apply. */
export function findConflicts(
  bindings: EffectiveBindings,
  binding: Binding,
  scope: CommandScope,
  except?: CommandId,
): CommandId[] {
  return COMMANDS.filter(
    (c) =>
      c.id !== except &&
      scopesConflict(c.scope, scope) &&
      (bindings.get(c.id) ?? []).some((b) => sameBinding(b, binding)),
  ).map((c) => c.id)
}

/**
 * The command a key press runs in one scope (callers also check `app` on pages). An exact match
 * wins; failing that, an AltGr character (Ctrl+Alt that types something) matches the character
 * bindings, so a Ctrl+Alt combo the user recorded still comes first.
 */
export function commandForEvent(
  bindings: EffectiveBindings,
  scope: CommandScope,
  event: KeyEventLike,
): CommandId | null {
  const find = (matches: (b: Binding) => boolean) =>
    COMMANDS.find((c) => c.scope === scope && (bindings.get(c.id) ?? []).some(matches))
  const command =
    find((b) => matchesEvent(b, event)) ?? find((b) => matchesAltGrCharacter(b, event))
  return command?.id ?? null
}
