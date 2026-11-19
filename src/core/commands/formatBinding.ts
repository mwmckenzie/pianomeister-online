import type { Binding } from './Binding'

/** Names for keys that type nothing, or type something the UI shouldn't show raw. */
const KEY_NAMES: Readonly<Record<string, string>> = {
  Space: 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
}

/** What the physical keys type on a US layout, when the browser can't tell us the real one. */
const US_LAYOUT: Readonly<Record<string, string>> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '\\',
  NumpadAdd: '+',
  NumpadSubtract: '-',
  NumpadMultiply: '*',
  NumpadDivide: '/',
  NumpadDecimal: '.',
}

function physicalKeyName(code: string, layout?: ReadonlyMap<string, string>): string {
  const named = KEY_NAMES[code]
  if (named !== undefined) return named
  if (/^F\d{1,2}$/.test(code)) return code
  // What the key types on the user's layout (navigator.keyboard.getLayoutMap, Chromium).
  const typed = layout?.get(code)
  if (typed !== undefined && typed !== '') return typed.toUpperCase()
  const letterOrDigit = /^(?:Key|Digit|Numpad)([A-Z0-9])$/.exec(code)
  if (letterOrDigit?.[1] !== undefined) return letterOrDigit[1]
  return US_LAYOUT[code] ?? code
}

/**
 * How a binding is written everywhere in the app (chips, hints, tooltips, the cheat sheet):
 * "Space", "←", "Home", "Ctrl+Shift+K", "?", "B". Physical keys are named by what they type on
 * the user's layout when a layout map is given, else on a US layout; the Meta key by the
 * platform's name for it (`metaKeyLabel`: ⌘, Win or Meta). Ctrl is always "Ctrl".
 */
export function formatBinding(
  binding: Binding,
  layout?: ReadonlyMap<string, string>,
  metaLabel = 'Meta',
): string {
  if (binding.match === 'char') {
    return binding.value === ' ' ? 'Space' : binding.value.toUpperCase()
  }
  const parts: string[] = []
  if (binding.ctrl) parts.push('Ctrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  if (binding.meta) parts.push(metaLabel)
  parts.push(physicalKeyName(binding.value, layout))
  return parts.join('+')
}
