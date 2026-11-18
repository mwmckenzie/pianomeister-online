import type { CommandId } from './CommandId'
import type { CommandScope } from './CommandScope'
import { COMMANDS } from './COMMANDS'

/** The command a key runs in a scope (by KeyboardEvent.code), or null. */
export function commandForKey(scope: CommandScope, code: string): CommandId | null {
  const command = COMMANDS.find(
    (c) => c.scope === scope && (c.keys as readonly string[]).includes(code),
  )
  return command?.id ?? null
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Comma: ',',
  Period: '.',
  NumpadEnter: 'Enter',
}

/** How a key is written in the UI: "B" for `KeyB`, "," for `Comma`, "←" for `ArrowLeft`. */
export function keyLabel(code: string): string {
  const named = KEY_NAMES[code]
  if (named !== undefined) return named
  const letterOrDigit = /^(?:Key|Digit)(.)$/.exec(code)
  return letterOrDigit?.[1] ?? code
}

/** A command's first key as written in the UI (menu hints, tooltips). */
export function shortcutLabel(id: CommandId): string {
  const key = COMMANDS.find((c) => c.id === id)?.keys[0]
  return key === undefined ? '' : keyLabel(key)
}
