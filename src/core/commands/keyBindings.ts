import type { Binding } from './Binding'
import type { KeyBinding } from './KeyBinding'
import type { KeyEventLike } from './KeyEventLike'

const NO_MODIFIERS = { ctrl: false, alt: false, shift: false, meta: false } as const

/** A character binding: "b", ",", "?", "+". */
export function charKey(character: string): KeyBinding {
  return { kind: 'key', match: 'char', value: character.toLowerCase(), ...NO_MODIFIERS }
}

/** A physical-key binding: "Space", "ArrowLeft", or a combo like Ctrl+Shift+KeyK. */
export function codeKey(
  code: string,
  modifiers: Partial<Pick<KeyBinding, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {},
): KeyBinding {
  return { kind: 'key', match: 'code', value: code, ...NO_MODIFIERS, ...modifiers }
}

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS'])

/** A key that types a character (not Space: it's matched by its physical key). */
function isPrintable(key: string): boolean {
  return [...key].length === 1 && key !== ' '
}

/**
 * The binding a key press records (brief decision 87): a printable character without Ctrl,
 * Alt or Meta becomes a character binding (Shift folded in); everything else a physical-key
 * binding with its modifiers. A modifier key on its own is no binding.
 */
export function bindingFromEvent(event: KeyEventLike): KeyBinding | null {
  if (MODIFIER_KEYS.has(event.key) || event.code === '') return null
  if (!event.ctrlKey && !event.altKey && !event.metaKey && isPrintable(event.key)) {
    return charKey(event.key)
  }
  return codeKey(event.code, {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  })
}

/** Whether a key press triggers a binding. */
export function matchesEvent(binding: Binding, event: KeyEventLike): boolean {
  if (binding.match === 'char') {
    return (
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      isPrintable(event.key) &&
      event.key.toLowerCase() === binding.value
    )
  }
  return (
    event.code === binding.value &&
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift &&
    event.metaKey === binding.meta
  )
}

/**
 * AltGr (Windows, Linux) reports Ctrl+Alt, so "[" on a German keyboard arrives as Ctrl+Alt+8
 * with `key` "[". When no physical-key combo claims such a press, it still matches the
 * character it types (decision 87): the `[` binding works on every layout.
 */
export function matchesAltGrCharacter(binding: Binding, event: KeyEventLike): boolean {
  return (
    binding.match === 'char' &&
    event.ctrlKey &&
    event.altKey &&
    !event.metaKey &&
    isPrintable(event.key) &&
    event.key.toLowerCase() === binding.value
  )
}

export function sameBinding(a: Binding, b: Binding): boolean {
  return (
    a.kind === b.kind &&
    a.match === b.match &&
    a.value === b.value &&
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.meta === b.meta
  )
}
