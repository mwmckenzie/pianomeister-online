import type { Binding } from './Binding'
import type { CommandId } from './CommandId'
import { COMMANDS } from './COMMANDS'
import { MAX_KEYS } from './applyShortcutEdit'
import type { ShortcutOverrides } from './ShortcutOverrides'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toBinding(value: unknown): Binding | null {
  if (!isRecord(value) || value.kind !== 'key') return null
  if (value.match !== 'char' && value.match !== 'code') return null
  if (typeof value.value !== 'string' || value.value === '') return null
  const flag = (name: string) => value[name] === true
  if (value.match === 'char') {
    // Characters never carry modifiers (decision 87).
    return {
      kind: 'key',
      match: 'char',
      value: value.value.toLowerCase(),
      ctrl: false,
      alt: false,
      shift: false,
      meta: false,
    }
  }
  return {
    kind: 'key',
    match: 'code',
    value: value.value,
    ctrl: flag('ctrl'),
    alt: flag('alt'),
    shift: flag('shift'),
    meta: flag('meta'),
  }
}

/**
 * Stored shortcut overrides, checked (brief decision 88): unknown and fixed commands and
 * malformed keys are dropped, at most two keys per command; anything unreadable is no override.
 */
export function readShortcutOverrides(value: unknown): ShortcutOverrides {
  if (!isRecord(value)) return {}
  const out: Partial<Record<CommandId, readonly Binding[]>> = {}
  for (const command of COMMANDS) {
    const raw = value[command.id]
    if (!Array.isArray(raw) || ('fixed' in command && command.fixed)) continue
    out[command.id] = raw
      .map(toBinding)
      .filter((b): b is Binding => b !== null)
      .slice(0, MAX_KEYS)
  }
  return out
}
